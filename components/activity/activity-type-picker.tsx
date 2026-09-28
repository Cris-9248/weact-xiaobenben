"use client";

import { Plus } from "lucide-react";

import { ActivityTypeDialog } from "@/components/activity/activity-type-dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useActivityTypes } from "@/hooks/use-activity-types";
import {
  BUILT_IN_ACTIVITY_TYPE_META,
  BUILT_IN_ACTIVITY_TYPES,
  isBuiltInActivityType,
} from "@/lib/constants";
import { resolveActivityType } from "@/lib/activity-types";
import { cn } from "cn";
import type { ActivityType } from "@/lib/types";

/**
 * Activity type selection: the three fixed built-ins plus the user's own types,
 * with inline creation so adding one does not mean leaving a half-filled form.
 *
 * The built-ins stay a `ToggleGroup` (as they were before custom types existed)
 * and custom types are separate chips, rather than folding everything into one
 * group — the two are genuinely different things: one is a fixed product
 * decision, the other is user data that can vanish.
 */
export function ActivityTypePicker({
  value,
  onChange,
}: {
  value: ActivityType;
  onChange: (next: ActivityType) => void;
}) {
  const customTypes = useActivityTypes();
  const known =
    isBuiltInActivityType(value) || customTypes.some((t) => t.id === value);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        value={isBuiltInActivityType(value) ? [value] : []}
        onValueChange={(next) => {
          const picked = next[0];
          if (picked && isBuiltInActivityType(picked)) onChange(picked);
        }}
        variant="outline"
      >
        {BUILT_IN_ACTIVITY_TYPES.map((type) => (
          <ToggleGroupItem key={type} value={type}>
            {BUILT_IN_ACTIVITY_TYPE_META[type].label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {customTypes.map((type) => {
        const picked = value === type.id;
        return (
          <button
            key={type.id}
            type="button"
            aria-pressed={picked}
            onClick={() => onChange(type.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              picked ? "border-primary bg-secondary" : "hover:bg-muted"
            )}
          >
            {type.label}
          </button>
        );
      })}

      {/* The selected type was deleted (another tab, or the settings page while
          this form was open). Surfaced rather than silently clearing the
          selection, which would look like nothing was ever chosen. */}
      {!known && (
        <span className="rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground">
          {resolveActivityType(value, customTypes).label}（已删除）
        </span>
      )}

      <ActivityTypeDialog
        trigger={
          <Button type="button" variant="ghost" size="sm">
            <Plus data-icon="inline-start" />
            新建类型
          </Button>
        }
        // Select what was just created — the reason this lives in the form
        // rather than only on the settings page.
        onSaved={(saved) => onChange(saved.id)}
      />
    </div>
  );
}
