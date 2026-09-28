import Link from "next/link";
import { MapPin, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ActivityStatusBadge,
  ActivityTypeBadge,
} from "@/components/activity/activity-badges";
import { formatPerPerson, formatRelativeDay } from "@/lib/format";
import type { Activity } from "@/lib/types";

/**
 * 列表页的关键字段：类型、主题、时间、地点、人均、成员。
 * Everything else (说明、投票、分账…) is deliberately left to the detail page.
 */
export function ActivityCard({ activity }: { activity: Activity }) {
  const shown = activity.members.slice(0, 4);
  const overflow = activity.members.length - shown.length;

  return (
    <Link href={`/activities/${activity.id}`} className="block">
      <Card className="gap-0 py-0 transition-colors hover:bg-muted/40">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <ActivityTypeBadge type={activity.type} />
            <ActivityStatusBadge status={activity.status} />
            <span className="ml-auto text-xs text-muted-foreground">
              {formatRelativeDay(activity.startsAt)}
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="font-heading text-base font-semibold leading-snug">
              {activity.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatRelativeDay(activity.startsAt)} ·{" "}
              {new Intl.DateTimeFormat("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(activity.startsAt))}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {activity.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {activity.location.label}
              </span>
            ) : null}
            {activity.budgetPerPerson ? (
              <span>{formatPerPerson(activity.budgetPerPerson)}</span>
            ) : null}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex -space-x-2">
              {shown.map((member) => (
                <Avatar key={member.id} className="size-6 ring-2 ring-background">
                  <AvatarFallback className="text-[0.6rem]">
                    {member.nickname.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {overflow > 0 ? (
                <span className="grid size-6 place-items-center rounded-full bg-muted text-[0.6rem] text-muted-foreground ring-2 ring-background">
                  +{overflow}
                </span>
              ) : null}
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              {activity.members.length} 人
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
