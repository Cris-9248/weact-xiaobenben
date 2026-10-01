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
              // 「发起人」是信息，不该被挤掉；被挤的应该是可以省略的昵称。
              <div key={member.id} className="flex items-center gap-3">
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback>{member.nickname.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 truncate text-sm font-medium">
                  {member.nickname}
                </span>
                {member.id === activity.hostId ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    发起人
                  </span>
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
    // 标签是固定的短词（时间 / 地点 / 预计花费），值是**地址**那种可以很长、
    // 而且可能是一整串不可断字符的东西。`shrink-0` 保住标签，`min-w-0` +
    // `break-words` 让值换行，而不是把卡片撑破（`Card` 是 overflow-hidden，
    // 撑破的表现是右边那截看不见，不是出现滚动条）。
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium wrap-break-word">
        {value}
      </span>
    </div>
  );
}
