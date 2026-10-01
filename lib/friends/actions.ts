"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { findUserByPhone } from "@/lib/auth/dal";
import { getSessionUser } from "@/lib/auth/session";
import { isRelationKind } from "@/lib/constants";
import { consumeAddFriendAttempt } from "@/lib/rate-limit";
import { isValidPhone, normalizePhone } from "@/lib/validation";

import {
  acceptFriendshipRequest,
  declineFriendshipRequest,
  deleteFriendship,
  markNotificationsSeen as markSeen,
  requestFriendship,
  updateRelation,
  withdrawFriendshipRequest,
} from "./dal";
import type { AddFriendFormState } from "./form-state";

/**
 * 好友关系的写入口。
 *
 * **这个文件里没有一处 try/catch**，和 lib/auth/actions.ts 一样，理由也一样：
 * `redirect()` 靠**抛异常**来中断，任何一层 catch 都会把它吞掉，表现是「操作
 * 成功了但页面不动」。
 *
 * 每个函数都自己读会话、自己确认那一行属于调用者。页面上的 `requireSessionUser`
 * 只决定「能不能看到这个界面」，决定不了「能不能改这一行」—— 一个 Server Action
 * 是一个任何人都能直接 POST 的端点，前端做了什么与它无关。
 *
 * `acceptFriendRequest` / `declineFriendRequest` / `withdrawFriendRequest` /
 * `removeFriend` 收的是一个**用户 id**，不是 `friendships.id`。授权不在这个文件里，
 * 在 DAL 的 WHERE 子句里：能被接受的那对边必须是 `(ta→我, pending)`，能被拒绝的必须
 * 是 `(ta→我, pending)`，能被撤回的必须是 `(我→ta, pending)`，能被删除的必须是我
 * 真的有一条指向 Ta 的 `accepted` 边。客户端能指名的是「一个人」，指不了「一行」，
 * 所以构造不出第三方的记录。`userIdOrNull` 那个形状守卫只是为了让手工 POST 得到
 * `{ok:false}` 而不是 Postgres 的 `22P02`（uuid 解析失败）—— 那是形状校验，不是授权。
 */

/** 把外部传进来的用户 id 收成「uuid 或 null」。见上面那段：形状，不是授权。 */
function userIdOrNull(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
    ? value
    : null;
}

/**
 * 统一回执文案。
 *
 * 「请求发出去了」「号码没注册」「对方还没取名」「本来就是好友」「被限流」
 * 五种情况**返回的都是这一个值**。它是这句条件句而不是「添加成功」，就是为了
 * 在没有真的添加时它也不说谎。
 *
 * **实测的边界，比「不可分」要窄，所以写清楚。** 下面每一条都是跑出来的字节数，
 * 不是推论（测量脚本见 PR；同一条断言在 25 次连打上也验过）。
 *
 * - 「号码没注册」与「注册了没取名」：**整个 HTTP 响应逐字节相同**（实测 108 字节）。
 *   这两条都不写库、不 `revalidatePath`，所以响应里只有返回值。
 * - 「被限流」：被限流时走的是同样的早退分支，响应与上面两条**逐字节相同** ——
 *   连打 25 次跨过 20 次/小时的线，26 个响应互相比对完全一致。这一条必须成立，
 *   否则限流本身就成了一个可观测的区分信号。
 * - 「本来就是好友」：**响应要大得多**（实测 15521 字节）。它没有早退分支 ——
 *   `requestFriendship` 会走 `sealFriendship` 的自愈路径，成功返回，于是
 *   `revalidatePath` 把重渲染后的 `/friends` 装进了同一个响应。
 *
 *   这是一处**与直通添加时代不同的**退化：以前四种「什么都没发生」的结果都是同
 *   一段 151 字节。它不构成新的泄漏 —— 调用者本来就能在自己的好友列表里看到
 *   「这个人是我的好友」和 Ta 的手机号，所以这个响应只确认了他已经知道的事。
 *   要抹平它，得让 addFriend 先查一次「我们是不是已经是好友」再决定要不要
 *   revalidate，那是为了一个不泄漏任何东西的差异多查一次库，不值得。
 * - **真的新建了一条待处理请求 / 触发了互发**时，响应同样带上重渲染的页面，且
 *   **含有目标用户的昵称**（出向那张「等待对方同意」卡片）。这一条是可区分的。
 *
 * 那一次可区分**不是这个 API 在回答问题，而是功能本身生效了** —— 界面要显示
 * 「请求已发出」，请求方就该看得见。真正限制「拿一堆号码来试」的是
 * lib/rate-limit.ts 那个每小时 20 次的窗口，不是这里的措辞。
 *
 * **改成请求制之后这条保证比直通添加时弱了一档。** 以前只有「真的成为好友」才可区分；
 * 现在「请求已发出」也可区分，而后者对「这个号码注册过没有」的回答是一样的。真正
 * 消除它需要不显示出向请求，而那就没有地方放「撤回」了 —— 用户明确选了这个取舍。
 *
 * 代价也要说清楚：**加了一个没注册的号码，界面不会告诉用户哪里错了。** 这是
 * CLAUDE.md「The phone-invite API must not leak whether a number is registered」
 * 强加的产品代价，不是实现疏漏。
 *
 * 文案本身在互发（直接成为好友）那种情况下略不精确 —— 对方看到的是一个新好友而不是
 * 一条请求。**不要为它分支**：分支会让响应体把「自动成为好友」也变成可区分的，
 * 那是一个新增的、现在还不存在的信道。
 */
const NOTICE = "如果对方已经注册，Ta 会在好友页看到你的好友请求。";

export async function addFriend(
  _prev: AddFriendFormState,
  formData: FormData,
): Promise<AddFriendFormState> {
  // 身份**只从会话读，不从表单读**。这是这个 action 的授权全部所在：没有
  // 「owner id」这种参数，调用方就没有东西可以伪造 —— 他能改的只有自己那几行。
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const phone = normalizePhone(String(formData.get("phone") ?? ""));

  if (!isValidPhone(phone)) {
    return { phoneError: "请输入有效的 11 位手机号" };
  }

  // 加自己单独报错，不并进那条统一回执。**这不泄漏任何东西**：这个号码是调用者
  // 自己的，他百分之百知道它注册过，信息量为零。而把它并进去，只会让一个明显
  // 的操作错误变得无法解释。
  if (phone === me.phone) {
    return { phoneError: "不能添加自己" };
  }

  // 关系取值白名单。这一列是 text 不是数据库 enum（见 lib/db/schema.ts），所以
  // 这里是唯一的把关点。界面的 Select 只会发出 `RELATIONS` 的成员，所以走不到
  // 回退分支 —— 但一个被构造的 POST 能走到，而它不该把任意字符串写进库。
  const rawRelation = String(formData.get("relation") ?? "");
  const relation = isRelationKind(rawRelation) ? rawRelation : "friend";

  // 限流在查库**之前**。被限流时返回的仍然是那条统一回执，不是错误 —— 否则
  // 限流本身就成了一种可观测的区分信号，把防枚举从侧门泄回去。
  if (!consumeAddFriendAttempt(me.id)) {
    return { notice: NOTICE };
  }

  const target = await findUserByPhone(phone);

  // 号码没注册、以及注册了但还没取昵称，合并成同一条路径。第二种不单独区分，
  // 是因为「注册完成」在这个 app 里的判定点就是有昵称（(app) 布局用的也是这条），
  // 而和一个没有名字的账号建立好友关系，双方界面上只会多出一行「未完成注册」。
  if (!target || !target.nickname) {
    return { notice: NOTICE };
  }

  // 对方已经向我伸过手的话，这一步直接把我俩变成好友（见 `requestFriendship`），
  // 但我**不**因此给用户一句不同的话：两种结果共用上面那条统一回执。返回值只用来
  // 表达「差事办完了」，不参与渲染。
  await requestFriendship(me.id, target.id, relation);

  // 好友页是服务端渲染的。不 revalidate 的话用户看不到刚发出去的请求 —— 而统一
  // 回执又不肯说「成功了」，那张出向卡片是请求存在的唯一反馈。
  revalidatePath("/friends");

  return { notice: NOTICE };
}

/**
 * 同意一份好友请求。`requesterId` 是发起方。
 *
 * 授权在 `acceptFriendshipRequest` 的 WHERE 里：对方必须真的向我伸过手。
 */
export async function acceptFriendRequest(
  requesterId: string,
): Promise<{ ok: boolean }> {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const other = userIdOrNull(requesterId);
  if (!other) return { ok: false };

  const ok = await acceptFriendshipRequest(me.id, other);

  // 只在真的写到东西时才失效缓存：`ok` 为 false 说明对方没请求过我（或已经处理过
  // 了），什么都没变，没有东西需要重算。
  if (ok) revalidatePath("/friends");

  return { ok };
}

/**
 * 拒绝一份好友请求。
 *
 * 请求方**不会**收到任何通知 —— 见 `declineFriendshipRequest` 的注释，那是删除这
 * 个动作的自然结果，不是这里额外做了什么。
 */
export async function declineFriendRequest(
  requesterId: string,
): Promise<{ ok: boolean }> {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const other = userIdOrNull(requesterId);
  if (!other) return { ok: false };

  const ok = await declineFriendshipRequest(me.id, other);
  if (ok) revalidatePath("/friends");

  return { ok };
}

/** 撤回我自己发出的请求。`friendId` 是当初想加的那个人。 */
export async function withdrawFriendRequest(
  friendId: string,
): Promise<{ ok: boolean }> {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const other = userIdOrNull(friendId);
  if (!other) return { ok: false };

  const ok = await withdrawFriendshipRequest(me.id, other);
  if (ok) revalidatePath("/friends");

  return { ok };
}

/**
 * 删除好友。**单边删除 = 双边删除** —— 我和 Ta 会互相从对方的好友列表里消失。
 *
 * 收的是对方的**用户 id**，不是 `friendships.id`（和上面三个一样）。这一条不是随手
 * 选的：这个动作要动**两行**，而「两行」只有用一对用户 id 才说得清；`setFriendRelation`
 * 那里传 `friendshipId` 是因为它只改自己那一行。
 *
 * **对方不会收到任何通知。** 不是这里少做了一步，是行被删掉之后没有东西可以拿来通知 ——
 * 见 `deleteFriendship` 的注释。
 *
 * **不加限流。** 只能删掉「曾经同意过你」的人，而反复「加了删、删了加」已经被
 * `addFriend` 那条 20 次/小时的窗口兜住了。给删除单独加限流只会挡住正当的清理动作。
 */
export async function removeFriend(friendId: string): Promise<{ ok: boolean }> {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const other = userIdOrNull(friendId);
  if (!other) return { ok: false };

  const ok = await deleteFriendship(me.id, other);

  // 只在真的删到东西时才失效缓存：`ok` 为 false 说明我们本来就不是好友（或对方先
  // 删了我），什么都没变，没有东西需要重算。
  if (ok) revalidatePath("/friends");

  return { ok };
}

/**
 * 把「已同意」的通知标记为看过。好友页挂载后由客户端组件触发一次。
 *
 * **它绝不能调 `revalidatePath`，也不要 refresh、不要碰 cookie。** 这不是风格问题，
 * 是需求的实现方式本身：
 *
 * `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` 写着，只有当
 * action 调用了 `revalidatePath` / `updateTag` / `refresh` 或改了 cookie 时，响应里
 * 才会带上重渲染后的页面；都不做的话**只带回返回值，当前路由不重渲染**。
 * `04-functions/revalidatePath.md` 也写着 Server Functions 会「立即更新 UI（如果
 * 正在看受影响的路径）」。
 *
 * 所以一旦在这里补上一句 revalidate，用户还站在好友页上，卡片右上角的 `new` 和
 * 通知区就会**当场消失** —— 而需求是「切换页面再切回好友页新样式消失」，也就是
 * 它必须活满这一次访问。下一次进好友页是一次真实的服务端往返，那时读到的 `seenAt`
 * 已经有值了，标记自然不再出现。
 *
 * 后来的人很容易把这里当成一处「漏掉的 revalidate」补上，所以这段话留在这儿。
 *
 * **它不负责刷新侧栏角标，而角标也不再需要它兜底。** 2026-10-01 查「同意后角标数字
 * 不变」时确认了两件事：一，角标长在 (app) 布局里，但任何调了 revalidate 的 action
 * 都会让服务端**从根重渲染**（`revalidatePath` 连 type 参数都不看，见
 * node_modules/next/dist/server/web/spec-extension/revalidate.js），所以同意/拒绝的
 * 响应里角标本来就是新算的；二，「同意」那条路已经不产生未读边了
 * （`lib/friends/dal.ts` 里 `sealFriendship` 的 `selfSeen`），这里没有东西要在事后补救。
 * 它现在唯一的职责就是把 `seen_at` 写进去，好让**下一次**进好友页时标记不再出现。
 */
export async function markNotificationsSeen(): Promise<void> {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  await markSeen(me.id);
}

/**
 * 改一条关系标注。
 *
 * **不是表单 action**：它由 RelationPicker 在客户端用 `startTransition` 调用。
 * 所以它不返回 form state，只返回「成没成」，让调用方决定要不要回滚乐观更新。
 *
 * `friendshipId` 是从客户端传进来的，但**授权不靠它**：真正决定能不能改的是
 * `updateRelation` 的 WHERE 子句里那个 `ownerId`，而 ownerId 来自会话。传一个
 * 别人的 friendshipId 进来，结果只是更新 0 行。
 */
export async function setFriendRelation(
  friendshipId: string,
  relation: string,
): Promise<{ ok: boolean }> {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  // 白名单。同上，这是 `relation` 列唯一的把关点。
  if (!isRelationKind(relation)) return { ok: false };

  const ok = await updateRelation(me.id, friendshipId, relation);

  // 只在真的改到时才失效缓存。`ok` 为 false 说明那一行不是调用者的（或不存在），
  // 什么都没变，没有东西需要重算。
  if (ok) revalidatePath("/friends");

  return { ok };
}
