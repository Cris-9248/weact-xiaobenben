"use client";

import { Snowflake, Sun } from "lucide-react";

import { cn } from "cn";
import { setTheme, type Theme } from "@/lib/theme";
import { useTheme } from "@/hooks/use-theme";

// `satisfies` keeps the literal narrowing `as const` gives while still failing
// the build if a Theme is added and this list isn't updated.
const OPTIONS = [
  { value: "warm", label: "温馨", Icon: Sun },
  { value: "cool", label: "冷酷", Icon: Snowflake },
] as const satisfies ReadonlyArray<{
  value: Theme;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}>;

/**
 * Two-state theme switch. There is no "system" option by design — the two
 * themes *are* the light and dark presentations.
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
      {OPTIONS.map(({ value, label, Icon }) => {
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
