/**
 * Database schema — the source of truth for table structure.
 *
 * `drizzle-kit generate` diffs this file against the migrations in ./drizzle
 * and writes the SQL; `drizzle-kit migrate` applies it. Nothing here runs at
 * request time.
 *
 * Naming: fields are camelCase (`avatarUrl`), the columns they map to are
 * snake_case (`avatar_url`), because drizzle.config.ts sets
 * `casing: "snake_case"`. That option must ALSO be passed to the runtime
 * `drizzle()` call in lib/db/index.ts — with it set in only one of the two
 * places, the ORM builds queries against column names that do not exist.
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Accounts. `phone` is the login identity, so its uniqueness is enforced by
 * the database: an application-level "is this taken?" check would race two
 * simultaneous signups and let both through.
 */
export const users = pgTable("users", {
  /**
   * UUID rather than a serial integer. Ids appear in URLs and share links, and
   * a counter would leak how many accounts exist and the order they were
   * created in. `gen_random_uuid()` is built into Postgres 13+.
   */
  id: uuid().primaryKey().defaultRandom(),

  /** E.164-ish, normalized: `13800138000`. */
  phone: text().notNull().unique(),

  /**
   * Nullable, and deliberately so. Signing in with an unrecognised phone
   * number *creates* the account right there — phone and password arrive in
   * the same request — and the nickname is collected on the screen after it.
   * So there is a real window in which a row exists without one, and the
   * column has to admit that rather than invent a placeholder to satisfy
   * `notNull`. Application code reads a null nickname as "registration not
   * finished" — the row is real and signable, the account just has no name on
   * it yet. Nothing writes or clears it today; the Server Actions that close
   * that window are still to be built.
   */
  nickname: text(),

  avatarUrl: text(),

  /**
   * `scrypt:N:r:p:salt:hash`. The cost parameters travel inside the string, so
   * raising them later only affects passwords set after the change — every
   * existing hash stays verifiable. Never the password itself.
   */
  passwordHash: text().notNull(),

  /**
   * When the password was last set or changed. A timestamp rather than a
   * boolean because the *moment* is the useful part: sessions issued before it
   * can be treated as stale and revoked.
   */
  passwordSetAt: timestamp({ withTimezone: true }),

  /**
   * `withTimezone: true` is not optional. A bare `timestamp` stores wall-clock
   * with no offset, so the same instant written from two machines becomes
   * indistinguishable — and this app's data is timezone-aware throughout.
   */
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  /** `$onUpdate` fires for writes made through Drizzle; raw SQL bypasses it. */
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Login sessions. One row per signed-in device, so signing out of one does not
 * sign out the others, and "revoke everything" is a single delete by `userId`.
 */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),

    /**
     * `cascade` matters: deleting an account must take its sessions with it.
     * Without it the delete fails on the foreign key, and the rows that
     * survive would be live credentials for a user that no longer exists.
     */
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /**
     * SHA-256 of the cookie value, hex-encoded. The cookie itself holds a
     * 256-bit random token; this column is what a database leak actually
     * exposes, and it is not usable as a credential.
     *
     * Plain SHA-256 rather than scrypt is deliberate. A password needs a slow
     * KDF because it is low-entropy and guessable; this token is 256 random
     * bits, so there is nothing to slow an attacker down to. And unlike a
     * password, this lookup runs on *every* authenticated request — putting a
     * KDF here would be a self-inflicted denial of service.
     */
    tokenHash: text().notNull().unique(),

    expiresAt: timestamp({ withTimezone: true }).notNull(),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  // Array form: Drizzle 0.45 deprecated the object form of this callback.
  // Indexed for "revoke every session belonging to this user", which is what a
  // password change and an account deletion both need.
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

/**
 * 好友关系。**有向的** —— 一行表示「owner 把 friend 标为 relation」，而不是一条
 * 无向的边。
 *
 * 为什么不是一条边两个用户：`lib/types.ts` 里 `RelationKind` 的注释写得很清楚，
 * 关系标注是单向的、只对 owner 可见，另一方可以对同一个人标成完全不同的关系。
 * 那句话只有在两边各有一行时才有地方落 —— 一行的话「对方的标注」根本没有存储位置。
 * 代价是建立一段关系要写两行，而且要在一个事务里（见 lib/friends/dal.ts 的
 * `sealFriendship`：两条语句之间那个「对方看得见我、我看不见对方」的状态没人能修）。
 *
 * `status = 'pending'` 的行也在这张表里，它是「A 想加 B、B 还没同意」。于是**一行
 * 存在不等于一段好友关系成立**，列出好友的查询必须带上 `status = 'accepted'`。
 *
 * 两列都是 `cascade`：删号必须带走它所有的好友边，否则留下一堆指向不存在用户的
 * 行，而它们还会被 `listFriends` 查出来。
 */
export const friendships = pgTable(
  "friendships",
  {
    id: uuid().primaryKey().defaultRandom(),

    /** 标注的拥有者。**每一次读写都必须按这一列过滤** —— 见下面的索引与 DAL。 */
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    friendId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /**
     * `RelationKind` 的一个成员，用 `text` 存而不是 pg enum。
     *
     * 取舍：enum 能把取值锁在数据库层，但 `RELATIONS` 是产品决定、加一个标签就要
     * 一次 `ALTER TYPE` 迁移，而这一层已经有应用侧对它做白名单校验（actions.ts
     * 用 `RELATIONS.includes` 挡在写库之前）。选择把灵活性留在产品侧、把校验放在
     * 唯一能同时看见「这次写的值」和「谁能写」的地方。
     */
    relation: text().notNull(),

    /** `relation === "other"` 时的自由文本说明。目前没有写入方，留给那个 UI。 */
    relationNote: text(),

    /**
     * `'pending' | 'accepted'`。一条 pending 的边就是「owner 想加 friend，还没被
     * 同意」—— 它不构成好友关系，任何列出好友的查询都必须把它滤掉。
     *
     * 用 `text` + CHECK 而不是 pg enum，但**理由和上面的 `relation` 不一样**。
     * `relation` 不约束是因为它是产品词汇表，加标签不该是一次 `ALTER TYPE`；这里是
     * 一个两态的封闭状态机，取值集合不会长。而写错的代价不对称：`relation` 写错只是
     * 渲染成一个不认识的标签（读取端有 `isRelationKind` 兜底），`status` 写错
     * （`'acceptd'`）会让这一行从**每一个**查询里静默消失 —— 好友凭空不见，没有
     * 任何报错。所以把这个集合交给数据库关。
     *
     * 默认值是限制性的 `'pending'`：漏写这一列的写入方得到一条待同意的请求，而不是
     * 一段未经对方同意的好友关系。代价是 0005 必须显式回填历史行。
     */
    status: text().notNull().default("pending"),

    /**
     * 关系真正成立的时刻（双方都点了头），**不是** `createdAt`。
     *
     * 两边的时间语义不同：请求方那一行的 `createdAt` 是**发请求**的时刻，同意方那一
     * 行是**建行**（即接受）的时刻。同一段关系在两个参与者的界面上显示不同的「开始
     * 于」是说不通的，而这个不对称的根源就是拿 `createdAt` 当成了关系的起点。它同时
     * 是「X 同意了你的好友请求」那条通知要显示的时间。
     *
     * 可空：pending 的行还没有这个时刻。
     */
    acceptedAt: timestamp({ withTimezone: true }),

    /**
     * **我自己**看过这条边的时刻。null = 还没看过，界面上的两处都由它而来：通知区里
     * 的「你和 X 已成为好友」，以及好友卡右上角那个 `new`。
     *
     * 为什么放在边上、不另开一张通知表：它要驱动的三件事（同意后的通知、new 标记、
     * 侧栏角标）都是「我这条边上」的属性，与边本身是同一个事实的三种投影。通知表
     * 唯一能多给的东西 —— 记录被拒绝 / 被撤回的事件 —— 恰恰是产品明确不要的（添加
     * 失败方不该收到任何通知）。边模型因此天然不需要一个「抑制通知」的标志位。
     *
     * 唯一的写入方是好友页挂载后触发的那个 Server Action，**不能**在渲染期写。
     */
    seenAt: timestamp({ withTimezone: true }),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // 一个人对同一个人只能有一行。这条不只是防重复 —— 它同时是 addFriend 的
    // 幂等机制：重复添加会撞上它，`onConflictDoNothing` / `onConflictDoUpdate`
    // 让第二次收敛到同一个状态。
    //
    // 它顺带覆盖了 `WHERE owner_id = $1`（listFriends 的查询形状）—— btree 的
    // 最左前缀规则让前面那列单独可用。所以**不要**再为 owner_id 单独建一个索引：
    // 那是同一个东西的第二份拷贝，只增加写入成本。
    uniqueIndex("friendships_owner_friend_idx").on(table.ownerId, table.friendId),
    // 唯一索引帮不到 friend_id 这一侧，而它有三个用处：删号时 `onDelete: cascade`
    // 要按 friend_id 找到所有指向该用户的行（没有索引就是全表扫）、「谁加了我」
    // 那份待处理请求列表，以及侧栏角标的计数。和 sessions_user_id_idx 同一个理由。
    //
    // 角标那条会再过滤一次 `status = 'pending'`，而那一列的基数低（两个值）、
    // 选择性差，不值得为它单独建索引。真要优化时正确的动作是**把本索引换成**
    // `(friend_id, status)`（最左前缀仍然服务外键级联），而不是在旁边加第三个 ——
    // 正是 0004 删掉 friendships_owner_idx 时用过的理由。
    index("friendships_friend_id_idx").on(table.friendId),
    // 不能加自己。放在数据库而不是只放在 action 里：手工插入、将来的导入脚本、
    // 以及任何绕过 action 的写入都会经过这里。
    check("friendships_not_self", sql`${table.ownerId} <> ${table.friendId}`),
    // 状态机的取值集合交给数据库关，理由见上面 `status` 的注释。
    check(
      "friendships_status_valid",
      sql`${table.status} in ('pending', 'accepted')`,
    ),
  ],
);

/**
 * Admin sessions. Deliberately a separate table from `sessions`, not a flag on
 * it.
 *
 * The administrator is a single shared credential held in environment
 * variables, not an account — there is no row in `users` for it, and there
 * cannot be one. `users.phone` is NOT NULL and UNIQUE, and the application
 * layer validates it as an 11-digit mainland mobile number, so `admin` is not
 * a value it can hold. Reusing `sessions` would mean making `sessions.userId`
 * nullable purely to accommodate a row that is not a user, which weakens the
 * integrity of every real user session to buy nothing.
 *
 * Separate tables also keep the two identities from being confused for one
 * another: nothing that reads a user session can accidentally accept an admin
 * one, because they are different rows in different tables behind different
 * cookies.
 */
export const adminSessions = pgTable("admin_sessions", {
  id: uuid().primaryKey().defaultRandom(),

  /** Same construction as `sessions.tokenHash`, and for the same reasons. */
  tokenHash: text().notNull().unique(),

  /**
   * `sha256(username + NUL + password)`, hex-encoded — a digest of the
   * credential that authorised this session, never the credential itself.
   *
   * This column exists because the admin password lives in an environment
   * variable, where nothing ties it to the session rows already in the
   * database. Without this, changing ADMIN_PASSWORD would leave every
   * previously issued admin session working, and the only way to revoke one
   * would be to edit the database by hand. With it, `isAdmin()` compares the
   * stored digest against the current credentials on every read, so editing
   * the environment signs every existing admin session out.
   *
   * That is what the user side already promises for a password change
   * ("改密码 = 一次 delete 全部下线", lib/auth/session.ts) — this is the admin
   * equivalent, reached a different way because there is no row to delete.
   */
  credentialFingerprint: text().notNull(),

  expiresAt: timestamp({ withTimezone: true }).notNull(),

  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * A row as read back from the database. Named `…Row` to avoid colliding with
 * the `User` view type in lib/types.ts — related, but not the same thing: the
 * row carries fields the UI never shows, and `passwordHash` must never cross
 * into the view type.
 */
export type UserRow = typeof users.$inferSelect;
/** Insert shape: `id` and the timestamps may be omitted, the database fills them. */
export type NewUserRow = typeof users.$inferInsert;

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;

export type FriendshipRow = typeof friendships.$inferSelect;
export type NewFriendshipRow = typeof friendships.$inferInsert;

export type AdminSessionRow = typeof adminSessions.$inferSelect;
export type NewAdminSessionRow = typeof adminSessions.$inferInsert;
