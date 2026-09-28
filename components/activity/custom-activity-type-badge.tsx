"use client";

import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { useActivityTypes } from "@/hooks/use-activity-types";
import { resolveActivityType } from "@/lib/activity-types";
import type { ActivityType } from "@/lib/types";

/**
 * The client island for a non-built-in activity type.
 *
 * Only reached when the type is not one of the three built-ins — see
 * `ActivityTypeBadge`, which renders built-ins on the server and falls through
 * to this. Custom types live in localStorage, so their label and colour are
 * genuinely unknowable during the server render; before hydration this shows
 * the "未知类型" fallback for a frame, then corrects.
 */
export function CustomActivityTypeBadge({
  type,
  className,
}: {
  type: ActivityType;
  className?: string;
}) {
  const customTypes = useActivityTypes();
  const meta = resolveActivityType(type, customTypes);

  return (
    <Badge
      variant="secondary"
      className={cn("border-transparent", meta.accent, className)}
    >
      {meta.label}
    </Badge>
  );
}
