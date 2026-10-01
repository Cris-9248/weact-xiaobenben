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
    // **换行，不横滑。** 五个标签在 320px 下共约 444px，而可见区只有 288px；
    // 原来那套 `overflow-x-auto` + `[&::-webkit-scrollbar]:hidden` 不只是把内容截断，
    // 是**连「右边还有东西」这个提示一起删掉了** —— 两个目的地就此隐形。换行之后
    // 五个标签全部可见，代价只是窄屏上多占一行。
    //
    // `min-h-11` 是那条全局 44px 触控地板：`py-1.5` 加 `text-sm` 只有 32px。
    // `inline-flex items-center` 是配它来的（`min-height` 对纯 inline 元素无效）。
    <nav className="-mx-4 flex flex-wrap gap-1 px-4 pb-px md:mx-0 md:flex-nowrap md:px-0">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium transition-colors",
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
