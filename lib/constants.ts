import type {
  ActivityStatus,
  ActivityTypeMeta,
  BuiltInActivityType,
  RelationKind,
} from "@/lib/types";

export const APP_NAME = "Weact小本本";
export const APP_TAGLINE = "we activity · 一起活动";

/* --------------------------------- 活动类型 --------------------------------- */

/**
 * The built-ins, in display order. These three are fixed by product decision —
 * they cannot be renamed, deleted or recolored; custom types are added
 * alongside them. `BuiltInActivityType` is a literal union precisely so
 * `BUILT_IN_ACTIVITY_TYPE_META` below stays exhaustive.
 */
export const BUILT_IN_ACTIVITY_TYPES = [
  "dining",
  "play",
  "travel",
] as const satisfies readonly BuiltInActivityType[];

/** Narrows an `ActivityType` to a built-in. This is what lets the badge stay a
 *  Server Component for the common case: the server can decide from the type
 *  value alone, with no storage lookup. */
export function isBuiltInActivityType(
  type: string
): type is BuiltInActivityType {
  return (BUILT_IN_ACTIVITY_TYPES as readonly string[]).includes(type);
}

/** Display info for the built-ins. `needsTravel` replaces the `type === "travel"`
 *  checks that used to be scattered across the detail layout and travel page. */
export const BUILT_IN_ACTIVITY_TYPE_META: Record<
  BuiltInActivityType,
  ActivityTypeMeta
> = {
  dining: {
    id: "dining",
    label: "聚餐",
    accent: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    needsTravel: false,
  },
  play: {
    id: "play",
    label: "玩耍",
    accent: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    needsTravel: false,
  },
  travel: {
    id: "travel",
    label: "旅行",
    accent: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    needsTravel: true,
  },
};

/**
 * Auto-assigned accents for custom types, in assignment order.
 *
 * These are complete literal class strings on purpose: Tailwind v4 scans
 * source statically, so a name assembled at runtime (`bg-${hue}-500/10`) is
 * never generated and fails silently as an unstyled badge.
 *
 * The hues deliberately avoid the built-ins' amber / violet / sky, and each
 * carries a `dark:` text variant — the whole app remaps `dark:` onto the cool
 * theme (`@custom-variant dark` in globals.css), so one string covers both
 * themes. The 10%-tinted background reads on warm cream and on near-black
 * alike; the -700 / -400 text pair is what keeps contrast legible on each.
 */
export const ACTIVITY_TYPE_ACCENT_PALETTE = [
  "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  "bg-teal-500/10 text-teal-700 dark:text-teal-400",
  "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400",
  "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  "bg-pink-500/10 text-pink-700 dark:text-pink-400",
] as const;

/** Fallback shown when a type cannot be resolved — a deleted custom type, or
 *  one created on a different device. Deliberately not an error state: the
 *  activity still exists and has to keep rendering. */
export const UNKNOWN_ACTIVITY_TYPE_META: ActivityTypeMeta = {
  id: "",
  label: "未知类型",
  accent: "bg-muted text-muted-foreground",
  needsTravel: false,
};

/* --------------------------------- 活动状态 --------------------------------- */

export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  planning: "筹备中",
  ongoing: "进行中",
  finished: "已结束",
};

/* ---------------------------------- 关系 ---------------------------------- */

/**
 * 键的顺序**就是**下拉里的顺序（见下面 `RELATIONS`），所以这张表不只是文案。
 *
 * 2026-10-01 用户定稿的顺序与文案：好友，We，同事，同学，恋人，夫妻，家人，其他。
 * 两处容易看错的地方：
 *
 *   - `friend` 的文案从「朋友」改成了「好友」。**存储值没变**，所以老数据不用迁 ——
 *     变的只是它显示成什么。
 *   - `bestie`（文案「好友」）改名成 `we`（文案「We」），表示非常亲密的关系。
 *     这个是**真的改名**，老行需要迁移（`drizzle/0006_relation_we.sql`）。
 *   - `spouse`（夫妻）是这次新增的一档，没有老数据。
 */
export const RELATION_LABEL: Record<RelationKind, string> = {
  friend: "好友",
  we: "We",
  colleague: "同事",
  classmate: "同学",
  lover: "恋人",
  spouse: "夫妻",
  family: "家人",
  other: "其他",
};

export const RELATIONS = Object.keys(RELATION_LABEL) as RelationKind[];

/**
 * 关系取值的白名单校验。
 *
 * 两处需要它，理由不同：`friendships.relation` 那一列是 `text` 而不是数据库
 * enum（见 lib/db/schema.ts 的取舍说明），所以写入前要有东西挡住非法值；而读回
 * 来的行同样要防 —— 手工插入或将来的一次数据导入都可能留下一个 `RELATIONS`
 * 里没有的字符串，那时候界面需要的是回退而不是崩溃。
 *
 * `RELATIONS` 由 `Object.keys` 转出，所以校验范围和展示顺序永远同源：加一个
 * 关系只需要改上面那张表。
 */
export function isRelationKind(value: unknown): value is RelationKind {
  return (
    typeof value === "string" && (RELATIONS as readonly string[]).includes(value)
  );
}

/* ---------------------------------- 导航 ---------------------------------- */

export interface NavItem {
  href: string;
  label: string;
  /** lucide-react icon name, resolved in the nav component. */
  icon: "calendar" | "users" | "sparkles" | "user";
}

/**
 * 好友页的地址。单独抽出来，因为它在两个地方要**比较**而不是渲染：导航组件
 * 靠它判断哪个菜单项该挂徽标，`app/(app)/layout.tsx` 靠它决定数哪边的未读。
 * 比对字符串最怕的是第二个字面量写错一个字母 —— 那样徽标会安静地不出现。
 */
export const FRIENDS_HREF = "/friends";

export const NAV_ITEMS: NavItem[] = [
  { href: "/activities", label: "活动", icon: "calendar" },
  { href: FRIENDS_HREF, label: "好友", icon: "users" },
  { href: "/recap", label: "回顾", icon: "sparkles" },
  { href: "/settings", label: "我的", icon: "user" },
];
