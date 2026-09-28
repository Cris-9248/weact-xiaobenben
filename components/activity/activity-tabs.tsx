"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useActivityTypes } from "@/hooks/use-activity-types";
import { resolveActivityType } from "@/lib/activity-types";
import { cn } from "cn";
import type { ActivityType } from "@/lib/types";

/**
 * Link-based tabs rather than state-based ones, so each section is its own
 * route and stays deep-linkable.
 *
 * The travel tab is resolved here rather than by the caller because a custom
 * type's `needsTravel` flag lives in localStorage — a Server Component cannot
 * read it. For built-ins the answer is a static lookup, so nothing shifts on
 * hydration; only a custom type adds its tab a tick after mount.
 */
export function ActivityTabs({
  activityId,
  type,
}: {
  activityId: string;
  type: ActivityType;
}) {
  const pathname = usePathname();
  const customTypes = useActivityTypes();
  const base = `/activities/${activityId}`;
  const showTravel = resolveActivityType(type, customTypes).needsTravel;

  const tabs = [
    { href: base, label: "概览" },
    { href: `${base}/plan`, label: "计划 · 投票" },
    { href: `${base}/moments`, label: "评论 · 感想" },
    { href: `${base}/settle`, label: "打分 · 分账" },
    ...(showTravel ? [{ href: `${base}/travel`, label: "交通 · 住宿" }] : []),
  ];

  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-px md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
