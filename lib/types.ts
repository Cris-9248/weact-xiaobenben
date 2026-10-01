/** Domain model for Weact. Pure types — no runtime imports, safe anywhere. */

export type UserId = string;
export type ActivityId = string;

export interface User {
  id: UserId;
  /** E.164-ish, normalized: `13800138000`. The login identity. */
  phone: string;
  nickname: string;
  avatarUrl?: string;
  /** Null until the user completes the set-password step after auto-signup. */
  passwordSetAt?: string;
}

/**
 * The signed-in account, as handed to the UI.
 *
 * Deliberately NOT `UserRow` from `lib/db/schema.ts` — that type carries
 * `passwordHash`. Even if no component renders it, passing a row that contains it
 * into the component tree is an unnecessary exposure: one `console.log`, one
 * `"use client"` boundary added later, and it leaks. A type without the field
 * cannot leak it. Same rule as `AdminUserRow` in lib/admin/dal.ts.
 *
 * `nickname` is non-null here, unlike in the database. Reaching this type means
 * passing `requireSessionUser`, whose gate sends nameless accounts to
 * /register/password — so the nullable column is not a case the UI has to handle.
 *
 * Lives in this file rather than beside the session code because a Client
 * Component (the app shell) needs it, and everything in `lib/auth/` is behind
 * `import "server-only"`.
 */
export interface SessionUser {
  id: UserId;
  phone: string;
  nickname: string;
  avatarUrl: string | null;
}

/* ---------------------------------- 好友 ---------------------------------- */

/**
 * How *I* label a friend. Directed and visible only to the owner — the other
 * side may label the same friendship differently, so this never lives on the
 * friendship edge itself.
 *
 * 顺序即界面上的顺序（`RELATIONS` 由 `RELATION_LABEL` 的键序转出），所以这里
 * 改顺序等于改下拉，别当它是随便排的。
 *
 * `we` 原来的名字是 `bestie`，显示文案一直是「好友」；2026-10-01 用户把它定为
 * 「非常亲密的关系」，改名成 `we` 并给了一个数据迁移（`drizzle/0006_relation_we.sql`）。
 * 与此同时「朋友」那一档的**显示文案**改成了「好友」—— 存储值仍然是 `friend`，
 * 没有迁移，两件事别混。
 */
export type RelationKind =
  | "friend"
  | "we"
  | "colleague"
  | "classmate"
  | "lover"
  | "spouse"
  | "family"
  | "other";

/**
 * A friend, as handed to the UI: the other side's public profile and nothing else.
 *
 * Mirrors `SessionUser` above, with one deliberate difference — `nickname` is
 * nullable here. Reaching `SessionUser` means passing `requireSessionUser`, whose
 * gate turns nameless accounts away; a friend is whoever happens to be on the
 * other end of a `friendships` row, and phone-number signup creates the row
 * before it collects a name. The UI reads a null as 「未完成注册」.
 *
 * Lives in this file rather than in `lib/friends/dal.ts` for the same reason
 * `SessionUser` does: the activity form is a Client Component and needs to name
 * this shape, while everything in `lib/friends/` is behind `import "server-only"`.
 */
export interface FriendSummary {
  id: UserId;
  phone: string;
  nickname: string | null;
  avatarUrl: string | null;
}

/* ---------------------------------- 活动 ---------------------------------- */

/**
 * The three built-in types. Kept as a literal union so the display tables in
 * `lib/constants.ts` stay exhaustive — custom type ids are arbitrary strings
 * and can never be enumerated at compile time.
 */
export type BuiltInActivityType = "dining" | "play" | "travel";

/**
 * What `Activity.type` actually holds: a built-in slug, or a custom type id.
 *
 * Widening this to `string` costs us the compiler's help on lookups —
 * `tsconfig.json` does not set `noUncheckedIndexedAccess`, so
 * `Record<ActivityType, T>[key]` still types as `T` for a key that isn't
 * there and silently yields `undefined` at runtime. Every read therefore goes
 * through `resolveActivityType` in `lib/activity-types.ts`, which has a
 * fallback; never index a table with this directly.
 */
export type ActivityType = string;

/**
 * A user-defined activity type. Lives only on this device (localStorage) —
 * there is no backend yet.
 */
export interface CustomActivityType {
  /** Stable unique id. **Not** derived from the label, so renaming is free and
   *  never breaks activities that already reference it. */
  id: string;
  label: string;
  /**
   * Index into `ACTIVITY_TYPE_ACCENT_PALETTE`. Fixed at creation and stored on
   * the record rather than recomputed from array position, so deleting one
   * type can never recolor another.
   */
  paletteIndex: number;
  /** Opts activities of this type into the 交通·住宿 section. */
  needsTravel: boolean;
}

/**
 * Everything the UI needs to render one activity type — built-in or custom,
 * resolved or not. Produced only by `resolveActivityType`.
 */
export interface ActivityTypeMeta {
  id: ActivityType;
  label: string;
  /** Full literal Tailwind class string. Never assembled at runtime: Tailwind
   *  scans source statically, so `bg-${hue}-500/10` would silently not exist. */
  accent: string;
  needsTravel: boolean;
}

export type ActivityStatus = "planning" | "ongoing" | "finished";

export interface GeoPoint {
  label: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface Activity {
  id: ActivityId;
  type: ActivityType;
  /** 主题 */
  title: string;
  /** 时间 */
  startsAt: string;
  endsAt?: string;
  /** 地点定位 */
  location?: GeoPoint;
  /** 预计花费（总额，单位：元） */
  budgetTotal?: number;
  /** 预计人均（单位：元） */
  budgetPerPerson?: number;
  /** 具体说明 */
  description?: string;
  coverUrl?: string;
  hostId: UserId;
  /** 小团体 — the subgroup pulled into this activity. */
  members: User[];
  status: ActivityStatus;
  createdAt: string;
}

/* --------------------------- 初步计划 · 投票 · 决定 --------------------------- */

export interface PlanProposal {
  id: string;
  activityId: ActivityId;
  author: User;
  title: string;
  detail?: string;
  location?: GeoPoint;
  startsAt?: string;
  /** 预估人均 for this proposal. */
  estimatedPerPerson?: number;
  createdAt: string;
}

export interface Vote {
  id: string;
  proposalId: string;
  voter: User;
  createdAt: string;
}

/** The proposal the group landed on. Exactly one per activity once decided. */
export interface PlanDecision {
  activityId: ActivityId;
  proposalId: string;
  decidedAt: string;
}

export interface ProposalWithVotes extends PlanProposal {
  votes: Vote[];
  /** Whether the signed-in user has voted for this proposal. */
  votedByMe: boolean;
}

/* ------------------------------- 评论 · 感想 ------------------------------- */

export type MomentKind = "text" | "image" | "voice";

export interface MomentAttachment {
  kind: MomentKind;
  url: string;
  /** Seconds, for voice notes. */
  duration?: number;
  width?: number;
  height?: number;
}

/**
 * Posted during or after the activity. `kind` is derived from which
 * attachment is present, so a moment is always exactly one of text/image/voice.
 */
export interface Moment {
  id: string;
  activityId: ActivityId;
  author: User;
  body?: string;
  attachments: MomentAttachment[];
  createdAt: string;
}

/* ----------------------------- 打分 · 分账 ----------------------------- */

export interface Rating {
  id: string;
  activityId: ActivityId;
  author: User;
  /** 1–5 stars. */
  score: number;
  comment?: string;
  createdAt: string;
}

export interface BillShare {
  user: User;
  /** What this person actually owes for this activity. */
  amount: number;
  /** What they already paid out of pocket. */
  paid: number;
}

export interface SplitBill {
  activityId: ActivityId;
  total: number;
  shares: BillShare[];
  /** Resolved by the bill UI; each edge is one transfer that settles the group. */
  settlements: Settlement[];
}

export interface Settlement {
  from: UserId;
  to: UserId;
  amount: number;
}

/* --------------------------- 旅行 · 实时交通住宿 --------------------------- */

export type TravelQuoteKind = "transport" | "lodging";

export interface TravelQuote {
  id: string;
  kind: TravelQuoteKind;
  /** 航班号 / 车次 / 酒店名 */
  title: string;
  provider?: string;
  fromLabel?: string;
  toLabel?: string;
  departAt?: string;
  arriveAt?: string;
  price?: number;
  currency?: string;
  /** When this quote was last refreshed — the UI shows staleness. */
  fetchedAt: string;
  bookingUrl?: string;
}

/* ------------------------------ 回顾 · 亲密度 ------------------------------ */

export interface RecapStat {
  label: string;
  value: string | number;
  hint?: string;
}

export interface YearlyRecap {
  year: number;
  totalActivities: number;
  /**
   * Keyed by activity type. The key set is no longer enumerable: a custom type
   * can appear here, and a key may stop resolving if its type is deleted.
   *
   * `Partial` rather than a bare `Record` is load-bearing. A mapped type over
   * an open key type collapses into an index signature, so `byType[id]` would
   * type as `number` while actually reading `undefined` — and a template
   * literal accepts that silently, rendering "undefined 次" with no compiler
   * complaint. `number | undefined` is what forces a caller to handle the miss.
   */
  byType: Partial<Record<string, number>>;
  /** Distance in km, summed across travel activities. */
  totalDistanceKm?: number;
  /** The friend the user spent the most activities with. */
  topCompanion?: User;
  /** 12 buckets, Jan–Dec. */
  monthlyCounts: number[];
  highlights: RecapStat[];
}

export interface IntimacyScore {
  friend: User;
  /** 0–100, derived from shared activities, comments and recency. */
  score: number;
  sharedActivities: number;
  lastSeenAt?: string;
}

/* --------------------------------- 分享 --------------------------------- */

export interface ShareLink {
  token: string;
  activityId: ActivityId;
  createdBy: UserId;
  createdAt: string;
  expiresAt?: string;
  /** Whether the landing page exposes the guest list and bill. */
  includeMembers: boolean;
  includeBill: boolean;
}
