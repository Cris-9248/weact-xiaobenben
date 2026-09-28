import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { CustomActivityTypeBadge } from "@/components/activity/custom-activity-type-badge";
import {
  ACTIVITY_STATUS_LABEL,
  BUILT_IN_ACTIVITY_TYPE_META,
  RELATION_LABEL,
  isBuiltInActivityType,
} from "@/lib/constants";
import type { ActivityStatus, ActivityType, RelationKind } from "@/lib/types";

/**
 * Stays a Server Component on purpose. The built-in branch is decided from the
 * `type` value alone, which the server already has, so every activity in the
 * app today renders with zero client JS and no hydration cost. Only a genuinely
 * custom type falls through to the client island — its label lives in
 * localStorage, which the server cannot read.
 *
 * Note that indexing `BUILT_IN_ACTIVITY_TYPE_META` is safe here only because
 * the guard narrows `type` to the literal union; the table is exhaustive over
 * it. The unguarded lookups this file used to do are exactly what
 * `resolveActivityType` now exists to replace.
 */
export function ActivityTypeBadge({
  type,
  className,
}: {
  type: ActivityType;
  className?: string;
}) {
  if (!isBuiltInActivityType(type)) {
    return <CustomActivityTypeBadge type={type} className={className} />;
  }

  const meta = BUILT_IN_ACTIVITY_TYPE_META[type];
  return (
    <Badge
      variant="secondary"
      className={cn("border-transparent", meta.accent, className)}
    >
      {meta.label}
    </Badge>
  );
}

export function ActivityStatusBadge({ status }: { status: ActivityStatus }) {
  return (
    <Badge variant={status === "ongoing" ? "default" : "outline"}>
      {ACTIVITY_STATUS_LABEL[status]}
    </Badge>
  );
}

export function RelationBadge({
  relation,
  note,
}: {
  relation: RelationKind;
  note?: string;
}) {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {relation === "other" && note ? note : RELATION_LABEL[relation]}
    </Badge>
  );
}
