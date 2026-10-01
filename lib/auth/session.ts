import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";

import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { sessions, users, type UserRow } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/types";

/**
 * 会话：cookie 里放一个不透明随机串，库里存它的 SHA-256。
 *
 * 为什么不是签名 cookie（把 userId 签名后塞进 cookie 就完事）：那样无法撤销，
 * 也看不见「这个账号现在有几台设备登着」。库表换来的是「改密码 = 一次 delete
 * 全部下线」和「登出真的让令牌作废」。
 *
 * 为什么库里存哈希而不是令牌本身：库泄露（备份、SQL 注入、日志）时，明文令牌
 * 是**立刻可用**的凭据；哈希不是。这里用不加盐的 SHA-256 而不是 scrypt，原因是
 * 令牌本身有 256 位随机性，没有可猜的空间，而 scrypt 会让每个已登录请求都慢
 * 几十毫秒 —— 那是自伤式 DoS，不是防护。
 */

const SESSION_COOKIE = "weact_session";
const TOKEN_BYTES = 32;
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * cookie 是不是该带 `Secure`。
 *
 * 不用 `NODE_ENV === "production"`：本项目的生产构建就是 docker compose 里
 * 那个裸 HTTP 的 3000 端口，没有 TLS 终结，带上 `Secure` 的 cookie 浏览器
 * 根本不会回传 —— 表现是「登录成功但一直是未登录状态」，极难查。
 *
 * 用 `x-forwarded-proto` 是让它描述**实际情况**：没有反向代理时这个头不存在，
 * 于是不带 Secure（开发、compose 都对）；哪天前面挂了 TLS 终结，它自动变成
 * https，Secure 也就跟着打开，不用改代码也不用加环境变量。
 *
 * 已知取舍：这个头在没有可信代理时是客户端可伪造的。伪造者顶多让 cookie 少一个
 * Secure 标志（自己也已经在 https 上了），或者让它多一个（那就只是自己登不上），
 * 不构成越权。
 */
async function shouldSecureCookie(): Promise<boolean> {
  const forwarded = (await headers()).get("x-forwarded-proto");
  return forwarded?.split(",")[0]?.trim() === "https";
}

/** 签发会话。只能在 Server Action / Route Handler 里调用 —— 渲染期不能写 cookie。 */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    // 不给 JS 读 —— 这是 XSS 之后最值钱的东西，别让它一条 document.cookie 就没了。
    httpOnly: true,
    // Lax 而不是 Strict：Strict 下，从外站（比如微信里点开的分享链接）第一次
    // 导航到本站时 cookie 不发，用户会看到「已登录状态却像没登录」。Lax 只挡
    // 跨站 POST，而 Server Action 的 POST 另有 Next 自己的 Origin 校验兜着。
    sameSite: "lax",
    secure: await shouldSecureCookie(),
    path: "/",
    // 和库里的 expiresAt 对齐。cookie 先过期的后果是用户被提前登出；库先过期的
    // 后果是 cookie 还在但查不到会话行 —— 两者都是登出，但后者会多查一次库。
    expires: expiresAt,
  });
}

/**
 * 读会话。渲染期可以调用（只读，不写），布局里的登录闸门就走这里。
 *
 * 过期的行不删，只查不到 —— 清理交给以后的一个定时任务。为什么不在每次读到
 * 过期行时顺手删：那会让一个只读的渲染路径变成写库，在 prerender 期间是错误。
 *
 * 包在 React 的 `cache()` 里是**请求级去重**，不是跨请求缓存：同一个请求里
 * 布局和它下面的页面会各调一次，不包就是一模一样的 JOIN 查两遍。`cache()` 是
 * React 的能力，与 `cacheComponents` 无关，本项目关着它照常生效。
 */
export const getSessionUser = cache(async (): Promise<UserRow | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return row?.user ?? null;
});

/**
 * `(app)` 分组里每个页面开头的那两行，外加窄投影。
 *
 * **调用它的是页面，不是布局。** 布局里那道闸门是乐观的，它决定「能不能看到
 * 壳子」，决定不了「这个页面会不会渲染」—— Next 的布局无法阻止同层的页面渲染，
 * 一个 Route Handler 更是完全绕开布局。所以每个页面自己调一次，两道门就长在
 * 数据旁边。布局也调它，只是为了不在壳子里渲染一个空头像；因为 `getSessionUser`
 * 被 cache 了，两边共用同一次查询，不额外花钱。
 *
 * 只在渲染期调用 —— 它靠 `redirect()` 中断，而 `redirect()` 是抛异常，
 * 所以任何一层 try/catch 都会把它吞掉（这条坑 lib/auth/actions.ts 里也记着）。
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();

  // 分两步而不是 `if (!user?.nickname)`：这两种情况去的地方不一样。
  if (!user) redirect("/login");
  if (!user.nickname) redirect("/register/password");

  return {
    id: user.id,
    phone: user.phone,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
  };
}

/**
 * 当前这个 cookie 对应 `sessions` 里的哪一行（返回的是 `token_hash`）。
 *
 * 唯一的存在理由：改密码要「留着手上的这台、把别的都踢掉」，而 `token_hash` 是那句
 * DELETE 唯一说得清「哪一行是我」的东西。**导出的是哈希，不是令牌本身** —— 明文令牌
 * 只应该在两个地方出现：签发时写进 cookie 的那一次，和读取时从 cookie 取出来的那一次。
 * 多一个地方碰它，就多一个地方可能在日志或错误里把它漏出去。
 *
 * 这是 DAL 和 cookie 之间唯一的接缝：`lib/auth/dal.ts` 里那句 DELETE 需要一个
 * `keepTokenHash`，但不该知道 cookie 是什么东西。调用方必须先自己过会话检查。
 *
 * 返回 null 只有一种可能：cookie 在这一次请求里消失了 —— 正常流程中不会发生，
 * 所以那个分支是给类型看的，不是给逻辑看的。
 */
export async function currentSessionTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

/** 登出：先删库里的行，再清 cookie。顺序反了的话，删库失败就只剩一个死 cookie。 */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }

  store.delete(SESSION_COOKIE);
}
