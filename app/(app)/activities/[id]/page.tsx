import { notFound } from "next/navigation";

import { ShareDialog } from "@/components/activity/share-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatPerPerson, formatTimeRange } from "@/lib/format";
import { activities, shareLinks } from "@/lib/mock-data";

export async function generateMetadata(props: PageProps<"/activities/[id]">) {
  const { id } = await props.params;
  const activity = activities.find((a) => a.id === id);
  return { title: activity?.title ?? "活动" };
}

export default async function ActivityOverviewPage(
  props: PageProps<"/activities/[id]">
) {
  const { id } = await props.params;
  const activity = activities.find((a) => a.id === id);
  if (!activity) notFound();

  const share = shareLinks.find((s) => s.activityId === activity.id);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>具体说明</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {activity.description ?? "还没有补充说明。"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>小团体</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.members.map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar className="size-8">
                  <AvatarFallback>{member.nickname.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{member.nickname}</span>
                {member.id === activity.hostId ? (
                  <span className="text-xs text-muted-foreground">发起人</span>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>预算</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="时间" value={formatTimeRange(activity.startsAt, activity.endsAt)} />
            <Separator />
            <Row
              label="地点"
              value={activity.location?.address ?? activity.location?.label ?? "待定"}
            />
            <Separator />
            <Row
              label="预计花费"
              value={
                activity.budgetTotal ? formatCurrency(activity.budgetTotal) : "待定"
              }
            />
            <Separator />
            <Row
              label="预计人均"
              value={
                activity.budgetPerPerson
                  ? formatPerPerson(activity.budgetPerPerson)
                  : "待定"
              }
            />
          </CardContent>
        </Card>

        {share ? (
          <ShareDialog
            activityTitle={activity.title}
            shareUrl={`/s/${share.token}`}
          />
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
