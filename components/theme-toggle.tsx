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
 * Labels must stay two characters. Three labelled options already fill ~214px
 * of the 224px desktop sidebar (`w-56`) — a three-character label overflows it.
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
 * `full` adds labels (sidebar, settings); `compact` is icons only (mobile top
 * bar, auth pages) and relies on `aria-label` for the accessible name.
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
              variant === "full"
                ? "px-3 py-1 text-xs"
                : "size-7 justify-center",
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
