"use client";

import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { useActivityTypes } from "@/hooks/use-activity-types";
import { resolveActivityType } from "@/lib/activity-types";
import { BUILT_IN_ACTIVITY_TYPES } from "@/lib/constants";
import type { ActivityType } from "@/lib/types";

/**
 * The per-type breakdown on the recap page.
 *
 * Client-rendered, unlike the badge (which keeps a server fast path), because
 * the custom half of the list is only knowable in the browser and there are
 * only ever a handful of cards here — splitting it into a server shell plus an
 * island would cost more than it saves.
 *
 * This also removes the one place that could not follow the constants: the page
 * used to hardcode `["dining", "play", "travel"]`, so a fourth type would never
 * have shown up no matter what else changed.
 */
export function TypeStats({
  totalActivities,
  byType,
}: {
  totalActivities: number;
  /** Keyed by type id. Values may be missing — see `countFor`. */
  byType: Partial<Record<string, number>>;
}) {
  const customTypes = useActivityTypes();

  const rows = useMemo(() => {
    const countFor = (id: ActivityType): number => byType[id] ?? 0;
    return [
      ...BUILT_IN_ACTIVITY_TYPES.map((id) => ({
        id,
        label: resolveActivityType(id, customTypes).label,
        count: countFor(id),
      })),
      // Only customs that actually have activities: the grid is four columns
      // wide, and a user with a dozen types would otherwise get a wall of
      // zero-cards pushing the real numbers off screen.
      ...customTypes
        .map((t) => ({ id: t.id, label: t.label, count: countFor(t.id) }))
        .filter((row) => row.count > 0),
    ];
  }, [byType, customTypes]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="活动总数" value={`${totalActivities} 次`} />
      {rows.map((row) => (
        <StatCard
          key={row.id}
          label={row.label}
          value={`${row.count} 次`}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
