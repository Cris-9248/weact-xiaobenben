import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";

/**
 * 管理员凭据：读环境变量，比对，别的什么都不做。
 *
 * 口令**不进源码**是这里唯一重要的决定。写死在 .ts 里的话它会被提交，然后
 * 永远留在 git 历史里 —— 包括改了密码之后，`git log -p` 里那一行照样在。
 * 环境变量是唯一能让密钥和代码分开走的路：.env.local 已被 .gitignore 的
 * `.env*` 覆盖，.dockerignore 里也有 `.env*`，所以它既进不了仓库也进不了镜像。
 *
 * 这个模块**不负责会话**（那是 session.ts），也不做任何 UI 判断 —— 它只回答
 * 「这对凭据对不对」，并且只在服务端回答。`import "server-only"` 是硬保证：
 * 一旦哪个客户端组件碰了它，构建直接失败，而不是把口令渲染进 HTML。
 */

/** 环境变量里没配、或配成了空白时，管理入口整体关闭。 */
type Credentials = { username: string; password: string };

/**
 * 读并检查环境变量。任何一项不可用都返回 null —— **失败关闭**。
 *
 * `typeof` 那一层不能省。`String(process.env.ADMIN_PASSWORD)` 在变量缺失时
 * 得到的是字符串 `"undefined"`：一个非空、且是可以猜到的口令。少了这一步，
 * 「忘记配置」就变成了「口令是 undefined 也能登进去」。
 *
 * `trim()` 只用来判断「是不是空的」；真正参与比对的仍然是**原值**，不 trim。
 * 静默地把用户设的口令改掉（哪怕只是去掉一个尾随空格）比留一个肉眼看不见
 * 的空格更难查。用户侧的密码也从不 trim，这里保持一致。
 */
function readCredentials(): Credentials | null {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (typeof username !== "string" || typeof password !== "string") return null;
  if (username.trim().length === 0 || password.trim().length === 0) return null;

  return { username, password };
}

/**
 * 定长常量时间比较。
 *
 * 两边都先过一遍 SHA-256 再比，有两个理由，缺一不可：
 *
 *   1. `timingSafeEqual` 在两个 Buffer **长度不等时抛异常**，不是返回 false。
 *      哈希之后两边恒为 32 字节，这个分支根本不存在。
 *   2. 直接比长度不等的原文，比较耗时本身就会泄漏长度。
 *
 * 反正要比的也不是什么需要抗碰撞的东西 —— 这里要的是「时间不随内容变化」，
 * 不是「不可逆」。
 */
function constantTimeEqual(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a, "utf8").digest();
  const digestB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * NFC 归一化，和 `lib/auth/password.ts` 里那套一致。
 *
 * 同一串字符在不同输入法/系统上可能是字节不同的等价序列。口令里只要有一个
 * 非 ASCII 字符（重音、中文），不归一化就会出现「密码明明是对的却登不进，
 * 而且报的是密码错误」。哈希只能统一长度，统一不了等价序列。
 */
function normalize(value: string): string {
  return value.normalize("NFC");
}

/**
 * 验凭据。**正确时返回 fingerprint，否则返回 null。**
 *
 * 返回 fingerprint 而不是 boolean 是有意的：那串摘要唯一能派上的用场就是
 * 存进 `admin_sessions.credential_fingerprint`，而取到它的前提是凭据已经验过。
 * 于是「没验过凭据却拿到 fingerprint」在类型上就不可能 —— 换成「先返回
 * boolean，再单独暴露一个 fingerprint 函数」，调用方就有了先用后验的机会。
 *
 * 任何情况下都不抛异常：配置缺失和口令错误都只是 false。
 */
export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<string | null> {
  const credentials = readCredentials();
  if (!credentials) {
    // 排障信息记在服务端。返回给调用方的**必须**和「口令错误」完全一样 ——
    // 否则「本部署还没配置管理员口令」会变成一个能被探测出来的状态位。
    console.error(
      "[admin] ADMIN_USERNAME / ADMIN_PASSWORD 未配置或为空白，管理员登录已关闭",
    );
    return null;
  }

  // 时间抹平，和 lib/auth/actions.ts 的注册分支同一套做法：真实的比对只是一次
  // 哈希，快得可以忽略，攻击者靠响应时间能把「口令对不对」这个问题问出个大概。
  // 先无条件跑一次 scrypt（约 50ms），让每一次尝试的代价相同。
  //
  // 说清楚它不是什么：这**不是限流**。它把单机尝试速率压到每秒几十次，仅此
  // 而已 —— 真正的防爆破仍然没有做，见 README 里记的那条待办。
  await verifyPassword(password, DUMMY_HASH);

  // 两个比较都要算，不能短路。写成 `userOk && constantTimeEqual(...)` 的话，
  // 用户名一错就跳过了口令比较，响应时间立刻变短 —— 等于告诉对方「用户名
  // 是对的」。这里宁可每次都算两遍。
  const usernameOk = constantTimeEqual(
    normalize(username),
    normalize(credentials.username),
  );
  const passwordOk = constantTimeEqual(
    normalize(password),
    normalize(credentials.password),
  );

  if (!usernameOk || !passwordOk) return null;

  return fingerprintOf(credentials);
}

/**
 * 这个摘要是不是**当前**凭据算出来的。
 *
 * `isAdmin()` 读路径上的那一半：它手上只有库里存的摘要，需要知道「签发它的
 * 那对凭据还在不在」。比对仍然走常量时间 —— 这个函数挡的是「拿一个旧指纹来
 * 试」，不该因为比较快就把时间信道让出去。
 *
 * 注意它和 `verifyAdminCredentials` 的分工：那个要**证明**凭据（所以跑
 * scrypt、要明文），这个只是拿已有的摘要核对（不跑 scrypt）。读路径在每个
 * 管理员请求上都会走，加 scrypt 就是自伤式 DoS —— 和 `sessions.tokenHash`
 * 不用 scrypt 是同一个理由。
 *
 * 没有暴露「取当前指纹」的函数，是有意的：摘要唯一的用途就是存进会话行，
 * 而拿到它的前提应该是凭据已经验过。给出一个能直接读的 getter，就等于给了
 * 一条绕过验证的捷径。
 */
export function isCurrentCredentialFingerprint(fingerprint: string): boolean {
  const credentials = readCredentials();
  if (!credentials) return false;

  return constantTimeEqual(fingerprint, fingerprintOf(credentials));
}

/**
 * `sha256(用户名 + NUL + 口令)`，hex。
 *
 * NUL 做分隔符是为了让 (a, bc) 和 (ab, c) 不会撞进同一个摘要。这里的两段
 * 都来自同一个环境变量文件，撞上的可能性本就极低，但这是个免费的、不需要
 * 想的正确性。
 *
 * 意义在 session.ts 那一侧：库里存了这个摘要，会话就跟着凭据走了。改掉
 * env 里的口令，所有已签发的管理员会话在下次读取时立刻失效 —— 不必去
 * 数据库里手删，因为 `admin_sessions` 里没有一行和 env 有外键关系。
 */
function fingerprintOf({ username, password }: Credentials): string {
  return createHash("sha256")
    .update(username, "utf8")
    .update("\0", "utf8")
    .update(password, "utf8")
    .digest("hex");
}
