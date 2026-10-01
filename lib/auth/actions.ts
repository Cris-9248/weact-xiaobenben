"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { consumePasswordChangeAttempt } from "@/lib/rate-limit";
import type { UserRow } from "@/lib/db/schema";
import {
  NICKNAME_RULES,
  PASSWORD_RULES,
  checkNickname,
  checkPassword,
  isValidPhone,
  normalizePhone,
} from "@/lib/validation";

import {
  changePassword,
  claimNickname,
  createUser,
  findUserByPhone,
  renameUser,
} from "./dal";
import type { AuthFormState, SettingsFormState } from "./form-state";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./password";
import {
  createSession,
  currentSessionTokenHash,
  destroySession,
  getSessionUser,
} from "./session";

/**
 * 登录 / 注册。
 *
 * 一个表单两条路径：号码认识就验密码，不认识就当场建号。没有验证码 —— 短信
 * 通道对个人开发者基本走不通，而新老用户在这里收的是同一个密码字段，再插一步
 * OTP 只会把流程拉长。
 *
 * **这个文件里没有一处 try/catch**，是有意的：`redirect()` 是靠**抛异常**来
 * 中断的，任何一层 catch 都会把它吞掉，表现是「登录成功但页面不动」。
 */

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // 客户端也校验了一遍，但那只是为了少一次往返。这里是唯一算数的一次：
  // Server Action 是一个任何人都能直接 POST 的端点，前端做了什么与它无关。
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  const password = String(formData.get("password") ?? "");

  if (!isValidPhone(phone)) {
    return { phoneError: "请输入有效的 11 位手机号" };
  }
  if (password.length === 0) {
    return { passwordError: "请输入密码" };
  }

  const existing = await findUserByPhone(phone);

  if (!existing) {
    return register(phone, password);
  }

  // 老用户**不检查密码强度规则**。规则是给新密码把关的；对一个已经存在的
  // 账号跑它，等于在规则收紧的那天把老用户关在自己账号外面 —— 而他们的密码
  // 明明是对的。这也是为什么客户端那一侧不能替这里做决定。
  if (!(await verifyPassword(password, existing.passwordHash))) {
    // 不区分「号码没注册」和「密码错了」：说了就等于把「这个号在不在本站」
    // 告诉任何一个人。见 form-state.ts 里 formError 那段。
    return { formError: "手机号或密码不对" };
  }

  return finish(existing);
}

/**
 * 陌生号码 → 建号。
 *
 * 口令强度规则只在这条路上把关，这是它唯一说得通的位置。
 */
async function register(
  phone: string,
  password: string,
): Promise<AuthFormState> {
  // 时间抹平。这条路径如果直接返回，会比「查到了但密码错」少跑整整一次
  // scrypt（几十毫秒），攻击者靠响应时间就能问出某个手机号注册过没有。
  // DUMMY_HASH 的明文是一个从没被用过的随机串，验什么都不过。
  await verifyPassword(password, DUMMY_HASH);

  const problems = checkPassword(password);
  if (problems.length > 0) {
    return {
      passwordError: `密码需满足：${problems.map((p) => PASSWORD_RULES[p]).join("、")}`,
    };
  }

  const created = await createUser(phone, await hashPassword(password));
  if (created) return finish(created);

  // createUser 返回 null 不是失败，是**并发**：另一个请求抢先用同一个号码建了。
  // 回头把它捞出来，按「已存在」的路走 —— 注意还要再验一次密码，因为对面那次
  // 请求用的**不保证是同一个密码**（同一个号，两个人几乎同时按了登录）。
  // 赢的那一次的密码说了算，输的那一方在这里被挡下。
  const winner = await findUserByPhone(phone);
  if (!winner || !(await verifyPassword(password, winner.passwordHash))) {
    return { formError: "手机号或密码不对" };
  }

  return finish(winner);
}

/**
 * 签会话，送去该去的地方。
 *
 * 昵称还是空的就送去补昵称 —— 这就是「待完成注册」的全部机制：不再有第二个
 * cookie，会话本身就是身份，而 `nickname IS NULL` 就是「注册没走完」的标记。
 * 代价是 `(app)` 布局里必须有一道对应的闸门，否则会出现没名字的用户。
 */
async function finish(user: UserRow): Promise<never> {
  await createSession(user.id);
  redirect(user.nickname ? "/activities" : "/register/password");
}

/**
 * 注册的最后一步：取名。
 *
 * 身份**只从会话读**，不从表单读。这一点是这个 action 的授权全部所在：没有
 * 「用户 id」这种参数，调用方就没有东西可以伪造 —— 他能改的只有自己那一行。
 * 如果这里改成从 FormData 里取 id（哪怕同时校验会话），那就成了一个「登录
 * 即可改任意人昵称」的端点。
 */
export async function completeRegistration(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // trim 之后才存。不 trim 的话「 小明 」和「小明」在库里是两个名字，而界面
  // 上看起来一模一样 —— 之后按昵称搜索、@ 人的功能会在这种行上出怪事。
  const nickname = String(formData.get("nickname") ?? "").trim();

  const problems = checkNickname(nickname);
  if (problems.length > 0) {
    return { nicknameError: problems.map((p) => NICKNAME_RULES[p]).join("、") };
  }

  // 认领而不是写入：`claimNickname` 带着 `nickname IS NULL` 条件，所以这一行
  // 已经有名字时它什么都不做。于是这个 action 天然是幂等的，也就不可能被拿来
  // 当改名接口用 —— 改名是「我的」里另一件事。
  await claimNickname(user.id, nickname);

  redirect("/activities");
}

/**
 * 登出。
 *
 * **必须挂在 `<form action={signOut}>` 上，不能是 onClick 或一个 `<Link>`。**
 * 退出是改状态的操作，只有 POST 才是对的语义：一个 GET 链接会被预取、被
 * 「下一页」、被任何爬虫顺手打开，然后把人登出。
 *
 * **「禁用 JS 也能用」这条已经不再成立了。** 2026-10-01 起退出登录走
 * components/settings/sign-out-button.tsx 的确认弹窗，弹窗本身要 JS 才打得开 ——
 * 提交那一下仍然是 form action（POST 语义保住了），但整条路不再是无 JS 可达的。
 * 别再拿这条当论据。
 *
 * 没有会话时调用也是安全的 —— `destroySession` 对空 cookie 是空操作，所以
 * 重复点、或者会话早已过期，都不会出错。
 *
 * 这里**不需要** `window.location.href`。那条要求来自 `<Activity>`，而
 * `<Activity>` 只在 `cacheComponents: true` 时才参与路由；本项目是关的，
 * 页面在导航时正常卸载，没有需要强制刷新的残留状态。`redirect()` 之后浏览器
 * 会按新 cookie 重新请求目标路由，闸门那一层也拦得住回退。
 */
export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/**
 * 改名（「我的」里那件事）。
 *
 * 和 `completeRegistration` 走的是 DAL 里两个不同的函数：那个走 `claimNickname`
 * （`nickname IS NULL`），只能给空位填一次，所以天然幂等、也就不可能被拿来当改名接口；
 * 这个走 `renameUser`，改的正是已经有值的那一行。**分开写不是为了对称，是为了让注册
 * 那条路继续写不进一个已有名字的行。**
 *
 * 身份只从会话读，同 `completeRegistration`：这里没有「用户 id」这种参数，调用方就
 * 没有东西可以伪造。
 */
export async function updateNickname(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  // 昵称还空着的账号正走在注册那条路上（`requireSessionUser` 会把它送去
  // /register/password）。它要是从这里进来，改的其实是「取名」—— 那一步归
  // `completeRegistration`，不在别处开第二个入口。顺带让下面那句比较有定义。
  if (!me.nickname) redirect("/register/password");

  // trim 之后再存，和注册那一步同一条理由：不 trim 的话「 小明 」和「小明」在库里
  // 是两个名字，而界面上看起来一模一样。
  const nickname = String(formData.get("nickname") ?? "").trim();

  const problems = checkNickname(nickname);
  if (problems.length > 0) {
    return { nicknameError: problems.map((p) => NICKNAME_RULES[p]).join("、") };
  }

  // 改成现在正叫着的名字 = 什么都没改。**返回成功**，不是错误：用户要的结果
  // （我叫这个名字）已经成立了。跳过写库还顺带省下一次 `updated_at` 的跳动
  // （`$onUpdate` 在任何一次 UPDATE 上都会自己跳）和一次没有意义的 revalidate。
  if (nickname === me.nickname) return { ok: true };

  if (!(await renameUser(me.id, nickname))) {
    return { formError: "没改成功，请重试" };
  }

  // 昵称长在**布局**里（桌面侧栏那一行、手机顶栏头像的首字母），页面里还有一张资料卡。
  // 这一句之后服务端会把当前这条路由整棵树重渲染一遍，新的 RSC payload 跟着 action 的
  // 响应一起回来 —— 布局在这一次渲染里，所以名字和首字母当场就变了。
  //
  // 只写 /settings，不写 `revalidatePath("/", "layout")`：这里没有 `"use cache"`，别的
  // 页面本来就是动态渲染、下一次请求自然读到新名字，清掉整棵客户端缓存是白干。
  // `getSessionUser` 那个 `cache()` 是请求级的，拦不住这次重渲染，不需要额外手段。
  revalidatePath("/settings");

  return { ok: true };
}

/**
 * 改密码，并把其他设备踢下线（当前这台留着）。
 *
 * **这个 action 是一个口令预言机，必须限流。** 「当前密码」那一栏的答案只有两种，而问的
 * 人手里已经有一个偷来的会话 cookie —— 没有限流的话，一个会话就等于一次不限次的在线
 * 爆破。见 lib/rate-limit.ts 里第二条窗口。
 *
 * 身份只从会话读。当前密码的哈希也来自这次会话查询（`getSessionUser` 返回整行，带着
 * `passwordHash`），所以这里不比别处多查一次库。
 *
 * **顺序是刻意的：先做不花钱的判断，再限流，再验当前密码，最后才 `hashPassword`。**
 * 于是一次被限流的调用连 scrypt 都跑不到，而当前密码错的调用不会白跑第二个 scrypt ——
 * 一个已经登录的人拿这个端点当 CPU 放大器是很容易想到的事。
 */
export async function updatePassword(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  // 新密码按新密码的规矩来。密码的 NFC 归一化在两个哈希函数**里面**
  // （lib/auth/password.ts），所以这里传原文，别自己先 normalize 一遍。
  const problems = checkPassword(next);
  if (problems.length > 0) {
    return {
      newPasswordError: `密码需满足：${problems
        .map((p) => PASSWORD_RULES[p])
        .join("、")}`,
    };
  }
  if (next !== confirm) {
    return { confirmPasswordError: "两次输入的新密码不一样" };
  }
  if (current.length === 0) {
    return { currentPasswordError: "请输入当前密码" };
  }

  // 限流只数「真的验了一次密码」的调用 —— 上面三条在验之前就返回了，不占额度。
  // 这是它和添加好友那条窗口唯一不同的地方：那里的额度是「尝试」，同一个号码试五次
  // 很正常；这里的额度是「猜测」，一小时里试五次当前密码就太正常了。
  //
  // 和添加好友不同，这里被限流可以**直说**：调用者已经握着这个账号的会话，「这个账号
  // 存在」是他早就知道的事，说一句「太频繁」不泄漏任何东西，而含糊其辞只会让一个正在
  // 改自己密码的人不知道发生了什么。
  if (!consumePasswordChangeAttempt(me.id)) {
    return { formError: "尝试过于频繁，请稍后再试" };
  }

  if (!(await verifyPassword(current, me.passwordHash))) {
    return { currentPasswordError: "当前密码不对" };
  }

  // 当前设备要留着：改密码不该把正在操作的这台也踢下去。
  const keep = await currentSessionTokenHash();
  if (!keep) redirect("/login");

  const changed = await changePassword(
    me.id,
    me.passwordHash,
    await hashPassword(next),
    keep,
  );

  // false = CAS 没中：这中间有另一次改密先把这一行改了（另一台设备，或者一次双击）。
  // 那一刻起用户手上这个「当前密码」确实不对了，所以这句话是准确的，不是兜底措辞。
  // 此时**没有**删任何会话 —— 整个事务一起没发生。
  if (!changed) return { currentPasswordError: "当前密码不对" };

  // 这里**没有** `revalidatePath`，和 `markNotificationsSeen` 那次是同一类判断：没有
  // revalidate / refresh / 改 cookie 的 action，响应里只带回返回值、当前路由不重渲染。
  // 而这正是这里要的 —— 这一页上没有任何东西显示密码状态（原来那行「已设置」随「账号」
  // 卡片一起删了），重渲染只会把刚填完的三个框再渲染一遍。后来的人别把它当成漏掉的
  // revalidate 补上去。
  return { ok: true };
}
