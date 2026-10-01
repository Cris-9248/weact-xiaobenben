import "server-only";

import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { sessions, users, type UserRow } from "@/lib/db/schema";

/**
 * 账号数据的出入口。
 *
 * 只做「按什么查、写什么列」，不做任何授权判断，也不碰明文口令 —— 传进来的
 * 已经是哈希。授权是 Server Action 的事，见 lib/auth/actions.ts。
 */

export async function findUserByPhone(phone: string): Promise<UserRow | null> {
  // 调用方必须先过 normalizePhone，否则 "138 0013 8000" 会查不到人，
  // 然后走到建号分支去建一个重复账号 —— 而唯一约束拦不住它，因为那两串
  // 字符串在库里本来就是两个不同的值。
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);

  return row ?? null;
}

/**
 * 建号。**可能返回 null** —— 这不是错误，是并发。
 *
 * 用 `onConflictDoNothing` 而不是「先查再插」：两个请求同时拿同一个陌生号码
 * 登录时，先查再插会让两个都查到「没有」，然后两个都去插，第二个撞上唯一约束
 * 抛异常，用户看到 500。交给数据库裁决，冲突的一方拿回空数组，由调用方决定
 * 接着怎么办（见 actions.ts 里那条 raced 分支）。
 *
 * `passwordSetAt` 在这一并写上：这一行诞生的同时就设定了密码，两者不是两件事。
 */
export async function createUser(
  phone: string,
  passwordHash: string,
): Promise<UserRow | null> {
  const [row] = await db
    .insert(users)
    .values({ phone, passwordHash, passwordSetAt: new Date() })
    .onConflictDoNothing({ target: users.phone })
    .returning();

  return row ?? null;
}

/**
 * 给一个还没有昵称的账号取名（注册的最后一步）。
 *
 * **`nickname IS NULL` 这个条件是这句 SQL 的全部意义**，不是顺手加的防御。
 * 没有它，这个函数就是一个「按 id 覆盖昵称」的写入口；有了它，它的语义被压
 * 缩成「认领」—— 只能给空位填一次。于是它不可能被拿去改一个已有用户的昵称，
 * 哪怕调用方的身份判断将来出了错。
 *
 * 返回 null 表示这一行本来就有昵称（或已经不存在了），不是错误。
 */
export async function claimNickname(
  userId: string,
  nickname: string,
): Promise<UserRow | null> {
  const [row] = await db
    .update(users)
    .set({ nickname })
    .where(and(eq(users.id, userId), isNull(users.nickname)))
    .returning();

  return row ?? null;
}

/**
 * 改名（「我的」里那件事）。
 *
 * **和 `claimNickname` 是两件事，别合并。** 那个函数的 `nickname IS NULL` 是它的全部
 * 意义 —— 它的语义被压缩成「认领」，只能给空位填一次，于是 `completeRegistration` 那条
 * 「登录即可调用」的路不可能被拿去改名。改名要动的恰恰是**已经有值**的那一行，所以它
 * 必须是一个单独的写入口。合并就等于把上面那个保证退回去。
 *
 * **不查重名。** `nickname` 在库里没有唯一约束，这不是疏漏：登录身份是手机号，昵称只是
 * 称呼，好友列表里昵称旁边永远跟着手机号，两个人同名是这个产品允许的状态（和
 * `completeRegistration` 保持一致）。应用层「先查再写」只会引入一场竞态 —— 两个请求
 * 同时查到「没人叫这个」，然后两个都写进去。
 *
 * `WHERE id = $1` 就是授权：id 来自会话。`updated_at` 由 schema 里的 `$onUpdate` 自己跳，
 * 不写。返回 false 表示没有这一行（账号在读取之后被删了），不是错误。
 */
export async function renameUser(
  userId: string,
  nickname: string,
): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ nickname })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  return rows.length > 0;
}

/**
 * 换密码，并把**除手上这台以外**的会话全部作废。
 *
 * **三件事必须在同一个事务里。** 理由不是「规范」，是失败时的样子：
 *   - 只改了哈希、没删会话：用户以为偷走 cookie 的人已经被踢下线，其实没有 —— 而他
 *     没有任何理由再点一次「修改密码」，所以这个状态**不会自愈**；
 *   - 只删了会话、没改哈希：用户以为旧密码已经作废，其实还能登 —— 同样不会自愈。
 * 两个中间态都是「用户相信了一件不成立的事」。代价是本地 Postgres 上一次 BEGIN/COMMIT
 * 往返，不值得为它省。和 `deleteFriendship` / `sealFriendship` 是同一条取舍。
 *
 * `expectedHash` 是 CAS：`WHERE password_hash = $2`。两台设备同时改密时，后到的那次
 * 匹配不到行、返回 false，而不是把先到的那次静默覆盖 —— 那一刻用户手上这个「当前密码」
 * 确实已经不对了，所以调用方回一句「当前密码不对」是准确的，不是兜底措辞。和
 * `claimNickname` 的 `IS NULL` 是同一个套路：判断和写入是同一个原子动作。
 *
 * `keepTokenHash` 是**当前设备**的那一行，留着它 —— 改密码不该把正在操作的这台也踢
 * 下线。它由调用方从会话模块取（`currentSessionTokenHash`），DAL 不碰 cookie。
 * `<>` 是精确的：`token_hash` 上有唯一约束，一次 DELETE 不可能让两行相撞。
 *
 * `passwordSetAt` 一起写。这一列存在的意思是「密码最后一次变动的时刻，早于它的会话可以
 * 当作陈旧」，今天真正干活的是上面那个 DELETE，但漏掉这一列会让它变成一个说谎的字段。
 * **将来若真的实现那条「陈旧」规则，必须把上面这个故意留下的会话排除掉** —— 它的
 * `created_at` 早于这次写入的 `password_set_at`，naive 地按时间过滤会把用户手上这台
 * 一起踢下线，而那正是这次改动要避免的事。
 */
export async function changePassword(
  userId: string,
  expectedHash: string,
  newHash: string,
  keepTokenHash: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(users)
      .set({ passwordHash: newHash, passwordSetAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.passwordHash, expectedHash)))
      .returning({ id: users.id });

    if (rows.length === 0) return false;

    await tx
      .delete(sessions)
      .where(
        and(eq(sessions.userId, userId), ne(sessions.tokenHash, keepTokenHash)),
      );

    return true;
  });
}
