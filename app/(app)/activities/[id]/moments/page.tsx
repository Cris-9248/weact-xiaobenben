import { notFound } from "next/navigation";
import { ImageIcon, Mic } from "lucide-react";

import { MomentComposer } from "@/components/activity/moment-composer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { formatDateTime, formatDuration } from "@/lib/format";
import { activities, moments } from "@/lib/mock-data";
import type { Moment } from "@/lib/types";

export const metadata = { title: "评论 · 感想" };

export default async function ActivityMomentsPage(
  props: PageProps<"/activities/[id]/moments">
) {
  const { id } = await props.params;
  const activity = activities.find((a) => a.id === id);
  if (!activity) notFound();

  const list = moments.filter((m) => m.activityId === id);

  return (
    <div className="space-y-4">
      <MomentComposer />

      {list.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>还没有感想</EmptyTitle>
            <EmptyDescription>
              活动过程中或结束后都可以发，支持文字、图片和语音。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        list.map((moment) => <MomentItem key={moment.id} moment={moment} />)
      )}
    </div>
  );
}

function MomentItem({ moment }: { moment: Moment }) {
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{moment.author.nickname.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{moment.author.nickname}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(moment.createdAt)}
            </p>
          </div>
        </div>

        {moment.body ? (
          <p className="text-sm leading-relaxed">{moment.body}</p>
        ) : null}

        {moment.attachments.map((attachment, i) => {
          if (attachment.kind === "image") {
            return (
              <div
                key={i}
                className="flex aspect-4/3 max-w-sm flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-muted/40 text-muted-foreground"
              >
                <ImageIcon className="size-5" />
                <span className="text-xs">
                  图片 {attachment.width}×{attachment.height}
                </span>
              </div>
            );
          }
          if (attachment.kind === "voice") {
            return (
              <div
                key={i}
                className="flex max-w-xs items-center gap-3 rounded-full border bg-muted/40 py-2 pr-4 pl-3"
              >
                <Mic className="size-4 text-muted-foreground" />
                <div className="flex h-4 items-end gap-0.5">
                  {[6, 12, 8, 14, 10, 16, 7, 11, 9, 13, 8, 10].map((h, j) => (
                    <span
                      key={j}
                      className="w-0.5 rounded-full bg-muted-foreground/50"
                      style={{ height: h }}
                    />
                  ))}
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatDuration(attachment.duration ?? 0)}
                </span>
              </div>
            );
          }
          return null;
        })}
      </CardContent>
    </Card>
  );
}
