import "server-only";

import { and, count, desc, eq, isNull, sql } from "drizzle-orm";

import { isRelationKind } from "@/lib/constants";
import { db, type DbTransaction } from "@/lib/db";
import { friendships, users } from "@/lib/db/schema";
import type { FriendSummary, RelationKind } from "@/lib/types";

/**
 * 好友数据的出入口。
 *
 * 只做「按什么查、写什么列」，不做任何授权判断 —— 授权是 Server Action 的事，
 * 见 lib/friends/actions.ts。下面每个函数都收一个 `ownerId`，但它**不是**调用方
 * 可以随便填的值：调用方必须先自己确认这个 id 来自会话。
 *
 * 这张表里同时躺着两种东西：`status = 'accepted'` 的好友边，和 `status = 'pending'`
 * 的待处理请求。**每一个「列出好友」的查询都必须自己带上 `status` 条件** ——
 * 少写一个，待同意的人就会出现在好友列表里。
 */

/**
 * 一行好友关系，带着好友的公开资料。
 *
 * 故意不是 `UserRow`（那个带 `passwordHash`）：`friend` 用 `FriendSummary`，
 * 一个没有密码字段的形状。这是 lib/admin/dal.ts 立下的同一条规矩 —— 类型上
 * 没有的字段，就没有泄漏的可能。
 */
export type FriendRow = {
  /** 好友边自己的 id。改关系标注时用它定位那一行。 */
  friendshipId: string;
  relation: RelationKind;
  /** `relation === "other"` 时的自由文本说明。目前没有写入方。 */
  relationNote: string | null;
  /**
   * 这段关系**真正开始**的时刻，即 `acceptedAt` 而不是 `createdAt`。
   *
   * 类型可空只是因为那一列可空：accepted 的行在实践中都有值（0005 迁移回填了
   * 历史行，`sealFriendship` 写入的每一行也都带着它）。留成可空而不是 `!` 或
   * 强制转换，是为了手工插入的、没有这个时刻的行能被诚实地表达出来。
   */
  since: Date | null;
  /**
   * 我还没在好友页上看过这条边 —— 卡片右上角要打 `new`。
   *
   * 和「X 同意了你的好友请求」那条通知、以及侧栏角标是同一个事实的三种投影，
   * 都由 `seenAt` 为 null 派生。
   */
  isNew: boolean;
  /** 昵称可空，理由见 `FriendSummary` 的注释。界面兜底显示「未完成注册」。 */
  friend: FriendSummary;
};

/**
 * 一条待处理的好友请求。入向和出向共用这个形状。
 *
 * **里面没有 `relation`，这是硬性的。** 入向那份请求行里的 `relation` 是**发起方
 * 给接收方标的**关系，而界面上的承诺是「关系标注只有你自己能看到」。A 把 B 标成
 * 「恋人」、然后发一条好友请求，B 不该看到「某某想加你（恋人）」。类型上没有这个
 * 字段，就没有泄漏的可能 —— 和 `FriendSummary`、`AdminUserRow` 是同一条规矩。
 *
 * 出向那一侧其实可以带（那是调用者自己标的），但两个方向共用一个类型，而出向的
 * 撤回卡片也用不到它，所以两边都不带。
 */
export type FriendRequestRow = {
  /** 对方是谁：入向是发起方，出向是目标。两个方向的查询里都是「不是我」那一方。 */
  other: FriendSummary;
  requestedAt: Date;
};

/** 两个方向的请求查询选出来的列形状一样，只有 join 的对象不同。 */
function toRequestRow(row: {
  userId: string;
  userPhone: string;
  userNickname: string | null;
  userAvatarUrl: string | null;
  requestedAt: Date;
}): FriendRequestRow {
  return {
    other: {
      id: row.userId,
      phone: row.userPhone,
      nickname: row.userNickname,
      avatarUrl: row.userAvatarUrl,
    },
    requestedAt: row.requestedAt,
  };
}

/**
 * 某个人的好友列表。
 *
 * `WHERE owner_id = $1` 是**唯一**让它返回正确集合的东西：`friendships` 是一张
 * 全表共享的边表，少了这个条件就是把所有人的好友边都倒出来。
 *
 * `status = 'accepted'` 是后加的第二个必需条件：pending 的行也在这张表里，不过滤
 * 的话「我发出去还没被同意的请求」会显示成好友。
 *
 * 用 `innerJoin` 而不是 `leftJoin`：`friend_id` 上有外键约束，配不到用户的行
 * 不可能存在，左连接只会白白引入「friend 可能是 null」这个不存在的分支。
 *
 * 排序用 `sql` 而不是 `desc(...)` 只是为了补上 `nulls last` —— Postgres 的 DESC
 * 默认把 NULL 排在最前，而那会让手工插入的、没有 `accepted_at` 的坏行顶到列表头上。
 */
export async function listFriends(ownerId: string): Promise<FriendRow[]> {
  const rows = await db
    .select({
      friendshipId: friendships.id,
      relation: friendships.relation,
      relationNote: friendships.relationNote,
      since: friendships.acceptedAt,
      seenAt: friendships.seenAt,
      friendId: users.id,
      friendPhone: users.phone,
      friendNickname: users.nickname,
      friendAvatarUrl: users.avatarUrl,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.friendId))
    .where(
      and(eq(friendships.ownerId, ownerId), eq(friendships.status, "accepted")),
    )
    .orderBy(sql`${friendships.acceptedAt} desc nulls last`);

  return rows.map((row) => ({
    friendshipId: row.friendshipId,
    // 这一列是 text 不是数据库 enum，所以读回来是 `string`，不能直接拿去索引
    // `RELATION_LABEL`（本项目没开 noUncheckedIndexedAccess，索引不到会静默渲染
    // 成空白，而不是报错）。回退到「其他」而不是抛错：一行脏数据不该让整个好友页
    // 打不开，而「其他」正是这个取值集合里为「说不清是什么」准备的那一个。
    relation: isRelationKind(row.relation) ? row.relation : "other",
    relationNote: row.relationNote,
    since: row.since,
    isNew: row.seenAt === null,
    friend: {
      id: row.friendId,
      phone: row.friendPhone,
      nickname: row.friendNickname,
      avatarUrl: row.friendAvatarUrl,
    },
  }));
}

/**
 * 谁想加我：指向我的、还没被处理的请求。
 *
 * join 的是 `owner_id` —— 发起方是这一行的 owner。写反成 `friend_id` 会立刻
 * 变成「我发出去的请求」，而且不会报错。
 */
export async function listIncomingRequests(
  ownerId: string,
): Promise<FriendRequestRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      userPhone: users.phone,
      userNickname: users.nickname,
      userAvatarUrl: users.avatarUrl,
      requestedAt: friendships.createdAt,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.ownerId))
    .where(
      and(eq(friendships.friendId, ownerId), eq(friendships.status, "pending")),
    )
    .orderBy(desc(friendships.createdAt));

  return rows.map(toRequestRow);
}

/**
 * 我发出去的、还没被处理的请求。join 的方向和上面相反。
 *
 * 这个列表是「撤回」按钮唯一的落点，代价见 lib/friends/actions.ts 顶部那段：
 * 它让「加了一个已注册的号码」在界面上留下痕迹，而加未注册的号码不会 ——
 * 防枚举因此比直通添加时弱。用户明确选择了这个取舍。
 */
export async function listOutgoingRequests(
  ownerId: string,
): Promise<FriendRequestRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      userPhone: users.phone,
      userNickname: users.nickname,
      userAvatarUrl: users.avatarUrl,
      requestedAt: friendships.createdAt,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.friendId))
    .where(
      and(eq(friendships.ownerId, ownerId), eq(friendships.status, "pending")),
    )
    .orderBy(desc(friendships.createdAt));

  return rows.map(toRequestRow);
}

/**
 * 侧栏角标上的数字：**待我处理的请求 + 我没看过的「已同意」**。
 *
 * 两个口径不一样，是有意的：
 *
 *   - **待处理的请求在点掉之前一直计数。** 它真的需要用户做一件事，看过不算数 ——
 *     用户完全可能扫一眼就切走了。
 *   - **「已同意」只在没看过时计数。** 它只是一条消息，进好友页就算读过了。
 *
 * 两个查询走 `Promise.all` 而不是拼一句带 FILTER 的裸 SQL：本地 Postgres 上多
 * 一次往返不值一提，换来的是类型完整、没有手写 SQL。`count()` 自带 `.mapWith(Number)`
 * （理由见 lib/admin/dal.ts:46-49），不需要手工 `::int`。
 *
 * 这个函数在 (app) 分组下**每一个页面**上都会被调用一次，因为它长在布局里，
 * 而布局读不到会话、更读不到库。两次都是索引上的小范围计数。
 */
export async function countFriendNotifications(
  ownerId: string,
): Promise<number> {
  const [incoming, unseen] = await Promise.all([
    db
      .select({ n: count() })
      .from(friendships)
      .where(
        and(
          eq(friendships.friendId, ownerId),
          eq(friendships.status, "pending"),
        ),
      ),
    db
      .select({ n: count() })
      .from(friendships)
      .where(
        and(
          eq(friendships.ownerId, ownerId),
          eq(friendships.status, "accepted"),
          isNull(friendships.seenAt),
        ),
      ),
  ]);

  return (incoming[0]?.n ?? 0) + (unseen[0]?.n ?? 0);
}

/**
 * 把我自己的「已同意」边标记为看过。好友页挂载后触发的那个 action 调它。
 *
 * **只碰 `owner_id = $me` 的行** —— 授权就是这一条，没有别的。
 *
 * 加了 `isNull(seenAt)` 条件，所以重复调用是空操作：第二次匹配不到任何行，
 * 也就不会把「第一次看见的时刻」往后推。开发模式下 React StrictMode 会双调用
 * 触发它的 effect，这个条件让那两次调用无害。
 */
export async function markNotificationsSeen(ownerId: string): Promise<void> {
  await db
    .update(friendships)
    .set({ seenAt: new Date() })
    .where(
      and(
        eq(friendships.ownerId, ownerId),
        eq(friendships.status, "accepted"),
        isNull(friendships.seenAt),
      ),
    );
}

/**
 * 把我俩落成两行 accepted 的边。**调用方必须先保证对方那一行存在。**
 *
 * 三件事按顺序：
 *
 *   1. 把对方指向我的那条 pending 行提升成 accepted。提升到了就往下走。
 *   2. 没提升到，就再查一次对方那一行**存在不存在**。不存在直接返回 false，
 *      一行都不写。这个分支同时是两件事：
 *      - **`acceptFriendRequest` 的授权本身**：传一个从没向我请求过的人进来，
 *        这里查不到行，于是什么都不会发生。
 *      - 自愈：对方那行已经是 accepted（我们本来就是好友，或者上一次执行死在
 *        了两条语句中间），继续往下走把缺的那行补上。
 *   3. upsert 我自己那一行。`set` 里**没有 `pending` 这个可能**，所以重复调用、
 *      并发调用都不会把一段好友关系退回请求。
 *
 * `acceptedAt` 用 `coalesce` 而不是直接写 now：已经 accepted 的行不该因为一次
 * 重放就把「关系开始的时刻」往后跳，而正在从 pending 提升的行需要填上它。
 *
 * **`${now}` 那里要写成 `now.toISOString()`，这不是可有可无的。** `sql` 模板里的
 * 普通 JS 值会当成裸参数直接交给驱动，**不过列的编码器** —— 而 `timestamp` 那一列
 * 的编码器（Date → ISO 字符串）正是 `.values()` / `.set()` 那条路替我们做的事。
 * 传一个 `Date` 对象进去，postgres-js 的 `Buffer.from` 会抛
 * `The "string" argument must be of type string or an instance of Buffer or
 * ArrayBuffer. Received an instance of Date`，整个事务回滚，界面上是一次
 * 「出了点问题」—— 而不是一个类型错误（`sql` 的参数是 `unknown`，tsc 看不见）。
 * 错误只在真的走到这条 upsert 时才出现，所以它是被端到端跑出来的，不是读出来的。
 *
 * **为什么要事务，而 `createMutualFriendship` 不需要。** 后者是**一条**带两个
 * VALUES 的 INSERT，Postgres 的语句级原子性已经够了。这里是两条语句、两行不同的
 * 记录，中间那个状态（对方的边 accepted、我的边不存在）是一段**单向好友关系**：
 * 对方列表里有我，我没有对方，而且两边界面都没有任何按钮能修它 —— 我的「同意」
 * 卡片已经随着那一行的提升消失了。半途失败留下的就是这种谁都修不了的状态。
 *
 * 已知的并发行为，写在这里而不是去建锁：
 *
 *   - **同时互发**（A 加 B 的同时 B 加 A）：两个事务都读到「没有反向行」，于是
 *     都插入 pending。这不是 bug：终态是两条互相的待处理请求，任一方点同意，
 *     这里的 upsert 会把**两行**一起提升。退化到慢路径，不会卡死。
 *   - **同时互相同意**：两个事务以相反的顺序锁这两行，Postgres 会死锁并中止其中
 *     一个（默认 `deadlock_timeout` 1s），表现为一次 Server Action 失败。有界、
 *     可恢复、不损坏：活下来那个留下两行 accepted，被中止的重试时走上面第 2 步
 *     的自愈路径收敛。真要根治是对规范化排序后的一对 id 上 `pg_advisory_xact_lock`，
 *     那是有实际并发压力之后的事。
 *
 * **`selfSeen`：我这一行出生时算不算「我已看过」。** 它是唯一区分两个调用方的参数，
 * 而区别不在代码里，在用户的处境里：
 *
 *   - `acceptFriendshipRequest` 传 `true`。我是**点下「同意」的那个人**，这段关系是
 *     我亲手促成的，没有任何我还不知道的信息。出生即已读之后，角标就是干净的：
 *     对方那行被提升成 accepted（`incoming` −1），我这边不新增未读（`unseen` 不变），
 *     数字立刻掉 1。传 `false` 的话这两项一加一减正好抵消，角标**纹丝不动** ——
 *     2026-10-01 用户报的就是这个。
 *   - `requestFriendship` 那条互发分支传 `false`。我以为只是发出去一个请求，结果
 *     对方早就问过我了、两人当场成为好友 —— 这件事**我不知道**，卡片是唯一的提示，
 *     所以要留成未读。这一档是用户明确要求保留的。
 *
 * 换句话说：**自己做的决定不通知自己，意外发生的事才通知。**
 */
async function sealFriendship(
  tx: DbTransaction,
  me: string,
  other: string,
  relation: RelationKind,
  selfSeen: boolean,
): Promise<boolean> {
  const now = new Date();

  const promoted = await tx
    .update(friendships)
    .set({ status: "accepted", acceptedAt: now })
    .where(
      and(
        eq(friendships.ownerId, other),
        eq(friendships.friendId, me),
        eq(friendships.status, "pending"),
      ),
    )
    .returning({ id: friendships.id });

  if (promoted.length === 0) {
    const [reverse] = await tx
      .select({ id: friendships.id })
      .from(friendships)
      .where(
        and(eq(friendships.ownerId, other), eq(friendships.friendId, me)),
      )
      .limit(1);

    if (!reverse) return false;
  }

  await tx
    .insert(friendships)
    .values({
      ownerId: me,
      friendId: other,
      relation,
      status: "accepted",
      acceptedAt: now,
      // 见 `selfSeen` 那段：同意时我这一行出生即已读，互发时留成未读。
      seenAt: selfSeen ? now : null,
    })
    .onConflictDoUpdate({
      target: [friendships.ownerId, friendships.friendId],
      set: {
        status: "accepted",
        // `now.toISOString()` 而不是 `now` —— 理由见上面那段注释，别改回去。
        acceptedAt: sql`coalesce(${friendships.acceptedAt}, ${now.toISOString()})`,
        // **只在我亲手促成时才补 seen_at。** 这条 `set` 只在「我这一行已经存在」
        // 时命中 —— 也就是两行互相 pending 的退化态下我点了同意，那时把它补成
        // 已读正是要的（`selfSeen` 为 false 时它什么都不该做，那行该保持未读）。
        //
        // 同样是 `coalesce` 而不是直接写 `now`：已经看过的行不该因为一次重放
        // 把「第一次看见的时刻」往后推。理由和上面 `acceptedAt` 那条一模一样。
        ...(selfSeen
          ? {
              seenAt: sql`coalesce(${friendships.seenAt}, ${now.toISOString()})`,
            }
          : {}),
      },
    });

  return true;
}

/**
 * A 向 B 发起好友请求。B 已经向 A 伸过手的话，两人**直接成为好友**。
 *
 * 互发自动成为好友不是一条单独的分支，而是 `sealFriendship` 的自然结果：B 那行
 * 指向 A 的 pending 边被提升掉，A 的新行直接以 accepted 出生。调用方因此不需要
 * 先查一次「对方是不是已经问过我了」。
 *
 * 返回 `"accepted"` 还是 `"requested"` 只给调用方做内部判断用 —— 对外两者是同一句
 * 回执，分支出去说会让响应体变成可区分的（见 actions.ts 那段）。
 *
 * `onConflictDoNothing` 覆盖两种情况：重复添加（我这行已经 pending），以及我这行
 * 早已 accepted（`sealFriendship` 第 2 步没查到反向行、但我的行确实存在的那种
 * 半损坏状态）。两种都不该把已有的事降级。
 */
export async function requestFriendship(
  me: string,
  other: string,
  relation: RelationKind,
): Promise<"requested" | "accepted"> {
  return db.transaction(async (tx) => {
    // `false`：互发时对方早就问过我这件事，我是不知道的，卡片要留下来（见
    // `sealFriendship` 的 `selfSeen` 那段）。
    if (await sealFriendship(tx, me, other, relation, false)) return "accepted";

    await tx
      .insert(friendships)
      .values({ ownerId: me, friendId: other, relation, status: "pending" })
      .onConflictDoNothing();

    return "requested";
  });
}

/**
 * 同意一份好友请求。`other` 是**发起方**。
 *
 * 授权完全在 `sealFriendship` 第 2 步那个「对方那行存在吗」的分支里：传一个没向我
 * 请求过的人进来，一行都不会写。客户端能指名的是一个**用户 id**，而能被接受的那
 * 对边必须是 `(ta→我, pending)`，构造不出第三方的行。
 *
 * 我自己对 ta 的标注是 `"friend"`：那是**我的**标注，我无权替对方决定什么
 * （沿用 `createMutualFriendship` 原来的理由）。
 */
export async function acceptFriendshipRequest(
  me: string,
  other: string,
): Promise<boolean> {
  // `true`：同意是我做的决定，我这一行出生即已读 —— 否则角标会 +1 抵消掉对方那行
  // 的 −1，数字纹丝不动（见 `sealFriendship` 的 `selfSeen`）。
  return db.transaction((tx) => sealFriendship(tx, me, other, "friend", true));
}

/**
 * 拒绝一份好友请求。
 *
 * **方向是反的**：我是被添加的一方，那一行属于发起者，所以是 `owner_id = other`。
 * 写成 `(me, other)` 会删掉我自己发出去的请求，或者什么都删不到 —— 一个不会报错
 * 的静默错误。
 *
 * `status = 'pending'` 是硬条件：没有它，一个构造出来的拒绝能删掉一段已经成立的
 * 好友关系。
 *
 * **请求方不会收到任何通知，这是结构性的、不是靠一个抑制标志位实现的**：行没了，
 * 而请求方的通知来源是「我的 accepted 边里 seenAt 为 null 的」，没有东西可以拿来
 * 通知。代价是拒绝可以被推断出来 —— 请求方下次进好友页时，那条「等待对方同意」
 * 消失了。既然选择了让请求方看到自己发出的请求，这一点就没法藏。
 */
export async function declineFriendshipRequest(
  me: string,
  other: string,
): Promise<boolean> {
  const rows = await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.ownerId, other),
        eq(friendships.friendId, me),
        eq(friendships.status, "pending"),
      ),
    )
    .returning({ id: friendships.id });

  return rows.length > 0;
}

/**
 * 撤回我自己发出的请求。方向和拒绝相反。
 *
 * 同样必须带 `status = 'pending'` —— 否则「撤回」就变成了一个静默解除好友关系的
 * 按钮，而且不会报错。
 */
export async function withdrawFriendshipRequest(
  me: string,
  other: string,
): Promise<boolean> {
  const rows = await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.ownerId, me),
        eq(friendships.friendId, other),
        eq(friendships.status, "pending"),
      ),
    )
    .returning({ id: friendships.id });

  return rows.length > 0;
}

/**
 * 删除一段好友关系。**单边删除 = 双边删除**，这是产品定义，不是副作用。
 *
 * 好友关系是**有向的两行**（见 lib/db/schema.ts 里那张表的注释），所以要让它对
 * 两个人同时消失，就必须删掉两行。
 *
 * **为什么必须是事务。** 两条语句、两行不同的记录，中间那个状态是一段**单向好友
 * 关系**：Ta 的列表里有我，我的列表里没有 Ta。而我的界面上那张卡已经没了 —— 没有
 * 任何按钮能修它。这个坏掉的状态只有 Ta 能修（Ta 那边还有卡，点删除会把两行一起
 * 清掉），我这边永远修不了。所以它必须整体成功或整体不发生。理由和 `sealFriendship`
 * 同源，只是方向相反。
 *
 * **为什么授权就是第一条语句。** 我必须真的有一条指向 Ta 的 accepted 边。
 * `status = 'accepted'` 不能省：去掉它，一个构造出来的调用能删掉一段还在等待的请求
 * （方向是反的，但那条 DELETE 不挑方向）。用 `DELETE … RETURNING` 而不是「先 SELECT
 * 再删」是因为后者有竞态 —— 查完到删之间那一行可能已经不是原来的样子了，而这里
 * 「判定」和「写入」是同一个原子动作。
 *
 * **为什么不写成一条带 `or(...)` 的 DELETE。** 那样在守卫不成立的时候，第二段
 * `(owner_id = other AND friend_id = me)` 照样会执行，把 **Ta 发给我的待处理请求**
 * 删掉 —— 一次不需要任何授权、就能删别人东西的写。所以守卫必须是独立的第一条语句，
 * 也就顺带要求了事务。
 *
 * **反向那一行故意不设 `status` 条件**，和上面那条形成对照：一旦授权通过，
 * 意图就是「我和 Ta 之间的一切都没了」，包括一条理论上不该存在、只在竞态里出现的
 * 残留 pending 行。留着它会让双方各自看到一张永远不会 resolve 的卡片。
 *
 * **不做自愈分支。** `sealFriendship` 有一步「反向行存在吗」的探测，因为那里要收敛到
 * 一个确定状态。这里不需要：我的边不存在（比如对方先把我删了）时返回 `false` 就够了，
 * 那种情况下我这边本来就没有卡可点。
 *
 * **被删的一方收不到任何通知，这是结构性的、不是靠一个抑制标志位实现的**：行没了，
 * 而通知的来源是「我的 accepted 边里 seenAt 为 null 的」，没有东西可以拿来通知。
 * 和 `declineFriendshipRequest` 是同一条理由。代价是「被删除」可以被推断出来 ——
 * 对方下次进好友页发现人不见了。既然选择了让双方都能看到自己的关系，这一点就没法藏。
 */
export async function deleteFriendship(
  me: string,
  other: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const mine = await tx
      .delete(friendships)
      .where(
        and(
          eq(friendships.ownerId, me),
          eq(friendships.friendId, other),
          eq(friendships.status, "accepted"),
        ),
      )
      .returning({ id: friendships.id });

    if (mine.length === 0) return false;

    await tx
      .delete(friendships)
      .where(
        and(eq(friendships.ownerId, other), eq(friendships.friendId, me)),
      );

    return true;
  });
}

/**
 * 改一条关系标注，返回有没有改到。
 *
 * **`ownerId` 出现在 WHERE 子句里，就是授权本身**：别人的行匹配不到，更新 0 行。
 * 这比「先查出来、在 JS 里比一下 ownerId、再更新」短，而且没有中间那一瞬间 ——
 * 查完到更新之间那一行可能已经不是原来的样子了。
 *
 * `status = 'accepted'` 是后加的条件：没有它，调用方可以给自己一条还在 pending 的
 * 请求行标关系。今天无害（那一行不会显示成好友），但那是一个不该可达的写入。
 *
 * 调用方仍然要自己确认传进来的 `ownerId` 来自会话；这里挡的是「改了别人的行」，
 * 挡不住「自称是别人」。
 *
 * 返回 `false` 把三种情况压成一种：不是你的行、行不存在、行还没被同意。调用方对
 * 它们的反应本来就该一样。
 */
export async function updateRelation(
  ownerId: string,
  friendshipId: string,
  relation: RelationKind,
): Promise<boolean> {
  const rows = await db
    .update(friendships)
    .set({ relation })
    .where(
      and(
        eq(friendships.id, friendshipId),
        eq(friendships.ownerId, ownerId),
        eq(friendships.status, "accepted"),
      ),
    )
    .returning({ id: friendships.id });

  return rows.length > 0;
}
