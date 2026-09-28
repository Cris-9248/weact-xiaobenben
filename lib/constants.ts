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

export const RELATION_LABEL: Record<RelationKind, string> = {
  friend: "朋友",
  bestie: "好友",
  lover: "恋人",
  family: "家人",
  colleague: "同事",
  classmate: "同学",
  other: "其他",
};

export const RELATIONS = Object.keys(RELATION_LABEL) as RelationKind[];

/* ---------------------------------- 导航 ---------------------------------- */

export interface NavItem {
  href: string;
  label: string;
  /** lucide-react icon name, resolved in the nav component. */
  icon: "calendar" | "users" | "sparkles" | "user";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/activities", label: "活动", icon: "calendar" },
  { href: "/friends", label: "好友", icon: "users" },
  { href: "/recap", label: "回顾", icon: "sparkles" },
  { href: "/settings", label: "我的", icon: "user" },
];
