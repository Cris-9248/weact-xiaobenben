"use client";

import { Briefcase, Snowflake, Sun } from "lucide-react";

import { cn } from "cn";
import { setTheme, THEMES, type Theme } from "@/lib/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * Keyed by `Theme`, so `Record` makes a missing entry a **compile error**.
 *
 * The previous `as const satisfies ReadonlyArray<…>` did not: `satisfies` only
 * checks the entries that are present, never that every `Theme` is listed.
 * Adding a theme to the union would have left it silently unreachable.
 *
 * 标签保持两个字。**注意这条原来的硬理由已经没了**：它当初是「三个两字标签占满
 * 224px 侧栏」，而侧栏那个入口 2026-10-01 撤掉了。现在 `full` 只剩「我的」页在用，
 * 那一行在 320px 下有 256px（实测这一档约 212px，三字也放得下）。所以这不再是
 * 一条会被撑爆的红线，只是密度上的偏好 —— 别拿它当挡箭牌，也别以为放宽了会出事。
 */
const THEME_META: Record<
  Theme,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  warm: { label: "温馨", Icon: Sun },
  cool: { label: "冷酷", Icon: Snowflake },
  business: { label: "商务", Icon: Briefcase },
};

/**
 * Theme switch. There is no "system" option by design — the themes are stored
 * preferences, not a system setting.
 *
 * 温馨 and 商务 are both light presentations; 冷酷 is the only dark one, and
 * `dark:` in globals.css is aliased to it alone.
 *
 * **只剩两个入口**（用户 2026-10-01 要求）：`full` 给「我的」页，`compact` 给登录/注册页。
 * 侧边栏和手机顶栏那两处已经撤掉 —— 应用内想切主题只能进「我的」。
 *
 * `compact` 不给登录页以外的任何地方用：它靠 `aria-label` 提供可访问名，图标本身
 * 不含文字，放在信息密集的导航里认不出来。
 */
export function ThemeToggle({
  variant = "full",
  className,
}: {
  variant?: "full" | "compact";
  className?: string;
}) {
  const theme = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="主题"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border bg-background/60 p-0.5 backdrop-blur-sm",
        className
      )}
    >
      {THEMES.map((value) => {
        const { label, Icon } = THEME_META[value];
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full font-medium transition-colors",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              // 两档都靠伪元素把**高度**撑到 44px，横向一律不扩：三个按钮之间只有
              // 2px（`gap-0.5`），横向一扩相邻两块的命中区就叠起来，点在第一个
              // 圆点的右半边会选中第二个主题。宽度本身在 WCAG 2.5.8 的 24px 下限
              // 之上，且互不重叠。整档 24px 高，要 10px；紧凑档 28px，要 8px。
              variant === "full"
                ? "relative px-3 py-1 text-xs after:absolute after:-inset-y-2.5"
                : "relative size-7 justify-center after:absolute after:-inset-y-2",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-3.5 shrink-0" />
            {variant === "full" ? label : null}
          </button>
        );
      })}
    </div>
  );
}
