"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Sparkles, User, Users } from "lucide-react";

import { cn } from "cn";
import { APP_NAME, NAV_ITEMS, type NavItem } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { me } from "@/lib/mock-data";

const ICONS: Record<NavItem["icon"], React.ComponentType<{ className?: string }>> =
  { calendar: CalendarDays, users: Users, sparkles: Sparkles, user: User };

/** `/activities/a_1` should still light up the `/activities` tab. */
function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  variant,
}: {
  item: NavItem;
  pathname: string;
  variant: "side" | "bottom";
}) {
  const active = isActive(pathname, item.href);
  const Icon = ICONS[item.icon];

  if (variant === "bottom") {
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.7rem] transition-colors",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <Icon className="size-5" />
        {item.label}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4" />
      {item.label}
    </Link>
  );
}

function Brand() {
  return (
    <Link href="/activities" className="flex items-center gap-2">
      {/* "We" needs more room than the old square monogram, so this is
          fixed-height and auto-width rather than `size-7`. */}
      <span className="grid h-7 place-items-center rounded-lg bg-primary px-2 text-xs font-bold tracking-tight text-primary-foreground">
        We
      </span>
      <span className="font-heading text-lg font-semibold tracking-tight">
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
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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
            <NavLink key={item.href} item={item} pathname={pathname} variant="side" />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <ThemeToggle className="self-start" />
          <div className="flex items-center gap-2 rounded-lg border p-2">
            <Avatar className="size-8">
              <AvatarFallback>{me.nickname.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{me.nickname}</p>
              <p className="truncate text-xs text-muted-foreground">{me.phone}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-md md:hidden">
        <Brand />
        <div className="flex items-center gap-2">
          <ThemeToggle variant="compact" />
          <Avatar className="size-8">
            <AvatarFallback>{me.nickname.slice(0, 1)}</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 pb-28 md:px-0 md:py-8 md:pb-8">
        {children}
      </main>

      {/* Mobile bottom tabs — padded for the home indicator. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} variant="bottom" />
        ))}
      </nav>
    </div>
  );
}
