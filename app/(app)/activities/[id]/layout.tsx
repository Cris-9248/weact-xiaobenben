import { notFound } from "next/navigation";
import { CalendarClock, MapPin } from "lucide-react";

import {
  ActivityStatusBadge,
  ActivityTypeBadge,
} from "@/components/activity/activity-badges";
import { ActivityTabs } from "@/components/activity/activity-tabs";
import { activities } from "@/lib/mock-data";
import { formatTimeRange } from "@/lib/format";

/** Route groups are stripped from the generated generic: `(app)` does not appear. */
export default async function ActivityLayout(
  props: LayoutProps<"/activities/[id]">
) {
  const { id } = await props.params;
  const activity = activities.find((a) => a.id === id);

  if (!activity) notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ActivityTypeBadge type={activity.type} />
          <ActivityStatusBadge status={activity.status} />
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          {activity.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-4" />
            {formatTimeRange(activity.startsAt, activity.endsAt)}
          </span>
          {activity.location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" />
              {activity.location.label}
            </span>
          ) : null}
        </div>
      </header>

      {/* The type, not a pre-computed boolean: a custom type's travel flag is
          only knowable in the browser. */}
      <ActivityTabs activityId={activity.id} type={activity.type} />

      {props.children}
    </div>
  );
}
