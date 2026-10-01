import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, MapPin, Users } from "lucide-react";

import {
  ActivityStatusBadge,
  ActivityTypeBadge,
} from "@/components/activity/activity-badges";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { APP_NAME } from "@/lib/constants";
import { formatCurrency, formatPerPerson, formatTimeRange } from "@/lib/format";
import { activities, shareLinks } from "@/lib/mock-data";

type Props = PageProps<"/s/[token]">;

export async function generateMetadata(props: Props) {
  const { token } = await props.params;
  const link = shareLinks.find((s) => s.token === token);
  const activity = activities.find((a) => a.id === link?.activityId);
  return {
    title: activity ? `${activity.title} · 邀请` : "分享的活动",
    // A share page must never be indexed — the token is the only credential.
    robots: { index: false, follow: false },
  };
}

/**
 * Public landing page for a share link. No session required, so it exposes
 * only what the link opted into (`includeMembers` / `includeBill`) and nothing
 * about the viewer. A real token is opaque, random, and optionally expiring.
 */
export default async function SharedActivityPage(props: Props) {
  const { token } = await props.params;
  const link = shareLinks.find((s) => s.token === token);
  if (!link) notFound();

  const activity = activities.find((a) => a.id === link.activityId);
  if (!activity) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
      <p className="text-sm text-muted-foreground">
        {APP_NAME} · 有人邀请你参加
      </p>

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

      <Card>
        <CardHeader>
          <CardTitle>活动说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="leading-relaxed text-muted-foreground">
            {activity.description ?? "还没有补充说明。"}
          </p>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">预计花费</span>
            <span className="font-medium">
              {activity.budgetTotal ? formatCurrency(activity.budgetTotal) : "待定"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">预计人均</span>
            <span className="font-medium">
              {activity.budgetPerPerson
                ? formatPerPerson(activity.budgetPerPerson)
                : "待定"}
            </span>
          </div>
        </CardContent>
      </Card>

      {link.includeMembers ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-4" />
              已加入 {activity.members.length} 人
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.members.map((member) => (
              // 这是**公开分享页** —— 一个没登录的人第一次看到这个应用，可能就是在
              // 320px 的手机上。同样的头像 + 20 字昵称 + 「发起人」组合，缺
              // `min-w-0` 的话溢出会被 `Card` 的 overflow-hidden 吃掉。
              <div key={member.id} className="flex items-center gap-3">
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback>{member.nickname.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 truncate text-sm">{member.nickname}</span>
                {member.id === activity.hostId ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    发起人
                  </span>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          想参加？登录 {APP_NAME} 后就能加入小团体、投票和记账。
        </p>
        {/* Styled link — see the note in `activities/page.tsx` for why this is
            not `<Button render={<Link />}>`. */}
        <Link href="/login" className={buttonVariants({ className: "mt-3" })}>
          登录 / 注册
        </Link>
      </div>
    </div>
  );
}
