"use client";

import { Placeholder } from "@/components/page-header";
import { useActivityTypes } from "@/hooks/use-activity-types";
import { resolveActivityType } from "@/lib/activity-types";
import type { ActivityType } from "@/lib/types";

/**
 * Decides whether an activity gets the 交通 · 住宿 section.
 *
 * This is a client component purely because a custom type's `needsTravel` flag
 * lives in localStorage, which the server cannot read — the page itself stays a
 * Server Component and passes its rendered output through as `children`, which
 * React does not re-render on the client.
 *
 * It also replaces a three-way assumption with a lookup: the old guard was
 * `type !== "travel"` plus `type === "dining" ? "聚餐" : "玩耍"`, which
 * confidently labelled *any* fourth type as 玩耍.
 */
export function TravelGate({
  type,
  children,
}: {
  type: ActivityType;
  children: React.ReactNode;
}) {
  const customTypes = useActivityTypes();
  const meta = resolveActivityType(type, customTypes);

  if (!meta.needsTravel) {
    return (
      <Placeholder>
        只有需要交通住宿的活动才有这些信息。当前活动是{meta.label}。
      </Placeholder>
    );
  }

  return <>{children}</>;
}
