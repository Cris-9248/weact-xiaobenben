import "server-only";

import { and, count, desc, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";

/**
 * 管理端的数据出入口。
 *
 * 和 `lib/auth/dal.ts` 一样，这里**只做数据访问，不做授权**。区别在于那边
 * 的授权有第二道（每一行都要确认属于调用者），而管理端没有「属于谁」这个
 * 概念 —— 所以下面每一条查询都要求调用方自己先确认过 `isAdmin()`。
 * 这是个裸模块，谁都能 import；它挡不住任何人。
 */

/**
 * 列表要展示的一行用户。
 *
 * 故意不是 `UserRow`。`UserRow` 带 `password_hash`，哪怕页面没渲染它，把它
 * 传进组件树就已经是一份不必要的暴露 —— 一次 `console.log`、一个将来加上
 * 的 `"use client"` 边界，泄漏就成立了。类型上没有这个字段，就没有这个可能。
 */
export type AdminUserRow = {
  id: string;
  phone: string;
  /** 可空：手机号登录即建号，昵称是注册之后一步才填的。 */
  nickname: string | null;
  createdAt: Date;
  passwordSetAt: Date | null;
  /** 尚未过期的会话数，不是「历史登录次数」。 */
  activeSessionCount: number;
};

/**
 * 所有用户，新的在前。
 *
 * 逐列列出而不是 `select()` 整行，理由见 `AdminUserRow`。
 *
 * 两个容易写错的地方：
 *
 *   - **`count(sessions.id)` 而不是 `count(*)`。** LEFT JOIN 下，一个从没登录
 *     过的用户那一侧的列全是 NULL。`count(*)` 数的是**行**，会给他算成 1；
 *     `count(某一列)` 忽略 NULL，才是 0。这正是这个查询里最容易出的错。
 *
 *   - **`count()` 不用手写 `sql` 模板加 `::int`。** Postgres 的 `count(*)` 是
 *     bigint，而 postgres-js 默认把 bigint 当**字符串**返回（内置的数字解析器
 *     不覆盖 int8）——不处理的话页面会渲染出 `"3"` 这种带引号的值。Drizzle 的
 *     `count()` 自带 `.mapWith(Number)`，在运行时转，不依赖驱动的类型表。
 *
 * join 条件里带 `gt(expiresAt, now)`：过期的会话行从来不删（用户侧已知的
 * 缺口，见 lib/auth/session.ts），不过滤的话这一列会随着时间只增不减。
 */
export async function listUsers(): Promise<AdminUserRow[]> {
  return db
    .select({
      id: users.id,
      phone: users.phone,
      nickname: users.nickname,
      createdAt: users.createdAt,
      passwordSetAt: users.passwordSetAt,
      activeSessionCount: count(sessions.id),
    })
    .from(users)
    .leftJoin(
      sessions,
      and(eq(sessions.userId, users.id), gt(sessions.expiresAt, new Date())),
    )
    // 按主键分组，所以 select 里的其他 users 列在 Postgres 下合法 —— 函数依赖
    // 规则：主键确定了，同一行的其他列也就确定了。换成 groupBy(users.phone)
    // 就会立刻报错，别改。
    .groupBy(users.id)
    .orderBy(desc(users.createdAt));
}
