import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";

import { db } from "@/lib/db";
import { adminSessions } from "@/lib/db/schema";

import { isCurrentCredentialFingerprint } from "./credentials";

/**
 * 管理员会话。整体镜像 `lib/auth/session.ts` —— 同样的不透明随机串、同样的
 * 库里只存 SHA-256、同样的「库表换来可撤销」。刻意不去抽公共函数：用户会话
 * 和管理员会话是两个安全域，它们的策略**应该**能各自演化（下面 TTL 和 cookie
 * 路径就已经不一样了），为了 DRY 把它们绑在一起，代价大于省下的那十几行。
 *
 * 唯一真源仍是 lib/auth/session.ts：`hashToken` 和 `shouldSecureCookie` 是从
 * 那里抄来的。改动其中一个时，记得看一眼另一个。
 */

const ADMIN_SESSION_COOKIE = "weact_admin_session";
const TOKEN_BYTES = 32;

/**
 * 12 小时，不是用户侧的 30 天。
 *
 * 管理员会话是一个**不绑定任何身份**的 bearer token：谁拿到 cookie 谁就是
 * 管理员，没有「这是谁的会话」可以用来做二次判断。而它能看到的页面列着所有人
 * 的手机号。用户侧的 30 天是拿便利换风险 —— 每天都要用的应用，频繁登录很烦；
 * 管理员页面是偶尔看一眼的东西，没有理由要一个月的有效期。
 */
const TTL_MS = 12 * 60 * 60 * 1000;

/**
 * cookie 限定在 /admin 下。
 *
 * 用户侧那个是 `path: "/"`，因为它确实在每个页面都要用。管理员 cookie 只在
 * /admin 下有意义，限定路径后它根本不会随用户端任何请求发出去 —— 少一份暴露
 * 面，也少一次被无关的日志/中间件看到的机会。
 *
 * 代价在 destroyAdminSession 那里，见那个函数的注释。
 */
const COOKIE_PATH = "/admin";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * 拷贝自 `lib/auth/session.ts`（那个文件没有导出它）。
 *
 * 判断依据是 `x-forwarded-proto` 而不是 `NODE_ENV === "production"`，理由见
 * 原文件：本项目的生产构建就是 compose 里那个裸 HTTP 的 3000 端口，带上
 * `Secure` 的 cookie 浏览器根本不会回传，表现是「登录成功但一直是未登录」。
 */
async function shouldSecureCookie(): Promise<boolean> {
  const forwarded = (await headers()).get("x-forwarded-proto");
  return forwarded?.split(",")[0]?.trim() === "https";
}

/**
 * 签发管理员会话。`fingerprint` 来自 `verifyAdminCredentials` —— 那是唯一能
 * 产出它的地方，所以这个函数不可能在凭据没验过的情况下被调到。
 */
export async function createAdminSession(fingerprint: string): Promise<void> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);

  await db.insert(adminSessions).values({
    tokenHash: hashToken(token),
    credentialFingerprint: fingerprint,
    expiresAt,
  });

  const store = await cookies();
  store.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await shouldSecureCookie(),
    path: COOKIE_PATH,
    expires: expiresAt,
  });
}

/**
 * 当前请求是不是管理员。**这是整个功能的授权边界。**
 *
 * 两道检查，缺一不可：
 *
 *   1. 会话行存在且没过期 —— 和用户侧一样。
 *   2. 行里存的摘要还等于当前 env 凭据的摘要。少了这道，改掉
 *      ADMIN_PASSWORD 之后所有已签发的管理员会话**继续有效**，而库里没有
 *      任何东西和 env 关联，想撤销只能手删数据库。
 *
 * 只查 `credential_fingerprint` 一列，不 `select()` 整行 —— 这个返回值会
 * 直接决定页面渲不渲染，让它多带一个字段出去没有任何好处。
 */
export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return false;

  const [row] = await db
    .select({ credentialFingerprint: adminSessions.credentialFingerprint })
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.tokenHash, hashToken(token)),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return false;

  return isCurrentCredentialFingerprint(row.credentialFingerprint);
}

/**
 * 登出：先删库里的行，再清 cookie。顺序和用户侧一致 —— 反过来的话，删库失败
 * 就只剩一个已经无用的 cookie 留在浏览器里，而库里那行还活着。
 *
 * **`delete` 必须带 path。** `store.delete("weact_admin_session")` 删不掉这个
 * cookie：Next 内部会把缺省的 path 补成 `"/"`，于是它发出的是一个
 * `Set-Cookie: ...; Path=/`，而浏览器里那个 cookie 的路径是 `/admin`，两者不
 * 匹配，删不掉。表现是「点了退出，回到 /admin 还是登录态」—— 而且库里的行
 * 已经删了，所以 next 一次请求又会把你弹回登录页，来回横跳。用户侧那个函数
 * 用裸字符串没事，只是因为它的 cookie 恰好是 `path: "/"`。
 */
export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_SESSION_COOKIE)?.value;

  if (token) {
    await db
      .delete(adminSessions)
      .where(eq(adminSessions.tokenHash, hashToken(token)));
  }

  store.delete({ name: ADMIN_SESSION_COOKIE, path: COOKIE_PATH });
}
