"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Sparkles, User, Users } from "lucide-react";

import { cn } from "cn";
import {
  APP_NAME,
  FRIENDS_HREF,
  NAV_ITEMS,
  type NavItem,
} from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { SessionUser } from "@/lib/types";

const ICONS: Record<
  NavItem["icon"],
  React.ComponentType<{ className?: string }>
> = { calendar: CalendarDays, users: Users, sparkles: Sparkles, user: User };

/** `/activities/a_1` should still light up the `/activities` tab. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 未读数的徽标。**`count <= 0` 时什么都不渲染** —— 不是渲染一个「0」，也不是渲染
 * 一个空元素：前者会让人以为有个叫 0 的东西要处理，后者会让 `data-slot` 断言在
 * 「没有消息」和「有零条消息」之间分不出来，而这两种情况在这个应用里是同一件事。
 *
 * 几何尺寸由调用方通过 `className` 给：侧栏和底栏的形状差得远，塞进一个组件里
 * 分支反而更难读。这里只管数字本身（上限、字宽）和外观。
 */
function NavBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;

  return (
    <span
      data-slot="nav-badge"
      className={cn(
        // `tabular-nums`：等宽数字，两位数和一位数切换时宽度不跳。
        "grid place-items-center rounded-full bg-primary font-medium tabular-nums text-primary-foreground",
        className,
      )}
    >
      {/* 封顶。四个 tab 在 320px 下每个约 80px，`1234` 会把底栏挤变形。 */}
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavLink({
  item,
  pathname,
  variant,
  badge = 0,
}: {
  item: NavItem;
  pathname: string;
  variant: "side" | "bottom";
  /** 待处理条数。0 表示不显示徽标。 */
  badge?: number;
}) {
  const active = isActive(pathname, item.href);
  const Icon = ICONS[item.icon];

  // 数字随菜单项一起读出来，而不是当成一个散落在旁边的文本节点。只在真的有
  // 徽标时才覆盖：`aria-label` 会**替换**整个链接的可读名，所以没消息的菜单项
  // 必须保持原样，否则「活动」会变成一个没有名字的东西。
  const label = badge > 0 ? `${item.label}，${badge} 条通知` : undefined;

  if (variant === "bottom") {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={label}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.7rem] transition-colors",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {/* `relative` 只为了给徽标当定位基准。底栏是 flex-col，没有「右侧」这个
            方向可用，只能把图标包起来、让数字浮在它的右上角。 */}
        <span className="relative">
          <Icon className="size-5" />
          <NavBadge
            count={badge}
            className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 text-[0.6rem] leading-none"
          />
        </span>
        {item.label}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {item.label}
      {/* `ml-auto` 把它顶到这条 `w-56` 行的右边缘 —— 用户要的「好友菜单右侧」。 */}
      <NavBadge
        count={badge}
        className="ml-auto h-5 min-w-5 px-1.5 text-[0.7rem]"
      />
    </Link>
  );
}

function Brand() {
  return (
    // `min-w-0` here plus `truncate` on the name are load-bearing at 320px.
    // The mobile top bar is `justify-between` with children that neither shrink
    // nor clip, so anything that widens the right-hand cluster pushes the row
    // past the viewport and the page scrolls sideways. The three-icon theme
    // toggle does exactly that — see the header below.
    // `min-h-11`：整个链接是这一行的可点目标，而它只有一个 28px 的 monogram
    // 撑着 —— 不补就是全应用最矮的导航入口。视觉高度不变，monogram 仍然 28px，
    // 多出来的是上下各 8px 的命中区。
    <Link
      href="/activities"
      className="flex min-h-11 min-w-0 items-center gap-2"
    >
      {/* "We" needs more room than the old square monogram, so this is
          fixed-height and auto-width rather than `size-7`. `shrink-0` keeps the
          monogram whole and forces the squeeze onto the name instead. */}
      <span className="grid h-7 shrink-0 place-items-center rounded-lg bg-primary px-2 text-xs font-bold tracking-tight text-primary-foreground">
        We
      </span>
      {/* 字号在窄屏降一档（`text-base` → `sm:` 回到 `text-lg`）。320px 下右侧那簇
          是固定的 134px（紧凑主题开关 94 + gap 8 + 头像 32），品牌这边拿到约
          142px；而 `Weact小本本` 在 `text-lg` 下要 141px —— 正好差几个像素，
          表现就是名字被截成 `Weact小本…`。降一档省下约 11px，装得下整个应用名。
          让字号而不是让结构承担这件事：`truncate` 留着当兜底，万一名字再长也不会
          把这一行撑出屏幕。 */}
      <span className="truncate font-heading text-base font-semibold tracking-tight sm:text-lg">
        {APP_NAME}
      </span>
    </Link>
  );
}

/**
 * Responsive chrome for every signed-in route: a fixed sidebar from `md` up,
 * a sticky top bar plus bottom tab bar below it. Keyed on pathname, so this
 * has to stay a Client Component — layouts themselves cannot read it.
 */
export function AppShell({
  user,
  friendNotifications,
  children,
}: {
  /** Resolved in the layout — this is a Client Component and cannot read the session. */
  user: SessionUser;
  /**
   * 好友页的未读数（待我处理的请求 + 我还没看过的「已同意」）。由布局在服务端
   * 数好传进来。
   *
   * 它是一次**快照**，不是订阅：这个数是本次渲染时读到的，用户在这一页上把请求
   * 点掉之后徽标不会自己变 —— 见 lib/friends/actions.ts 里 `markNotificationsSeen`
   * 关于「为什么不能 revalidate」的说明。产品上本来就不做实时推送。
   */
  friendNotifications: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  /** 只有好友那一项带徽标。用常量比对，不写第二份字面量。 */
  const badgeFor = (item: NavItem) =>
    item.href === FRIENDS_HREF ? friendNotifications : 0;

  return (
    // `flex-col` is required, not cosmetic: below `md` the sidebar is hidden but
    // the top bar is not, and a row-axis flex would put `<header>` and `<main>`
    // side by side — the bar rendering as a full-height left column.
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col md:flex-row md:gap-8 md:px-6">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-6 py-6 md:flex">
        <Brand />
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              variant="side"
              badge={badgeFor(item)}
            />
          ))}
        </nav>
        {/* 主题切换原来在这块账号卡上方（用户 2026-10-01 要求撤掉）—— 现在整个应用
            只有「我的」页和登录页两处能切主题，见 components/theme-toggle.tsx。
            `mt-auto` 负责把这唯一一块推到侧栏底部。 */}
        <div className="mt-auto flex items-center gap-2 rounded-lg border p-2">
          <Avatar className="size-8">
            <AvatarFallback>{user.nickname.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.nickname}</p>
            <p className="truncate text-xs text-muted-foreground">
              {user.phone}
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-md md:hidden">
        <Brand />
        {/* `shrink-0`: the avatar keeps its size and the brand name truncates,
            rather than the avatar being crushed. 手机顶栏原来还有一颗紧凑档主题
            切换（用户 2026-10-01 要求撤掉），撤掉之后这一簇只剩头像，少占约 94px ——
            窄屏下品牌名因此宽松了不少。 */}
        <Avatar className="size-8 shrink-0">
          <AvatarFallback>{user.nickname.slice(0, 1)}</AvatarFallback>
        </Avatar>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 pb-28 md:px-0 md:py-8 md:pb-8">
        {children}
      </main>

      {/* Mobile bottom tabs — padded for the home indicator. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            variant="bottom"
            badge={badgeFor(item)}
          />
        ))}
      </nav>
    </div>
  );
}
