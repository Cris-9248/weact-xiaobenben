import { notFound } from "next/navigation";
import { Star } from "lucide-react";

import { Placeholder } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { activities, moments, splitBill } from "@/lib/mock-data";

export const metadata = { title: "打分 · 分账" };

export default async function ActivitySettlePage(
  props: PageProps<"/activities/[id]/settle">
) {
  const { id } = await props.params;
  const activity = activities.find((a) => a.id === id);
  if (!activity) notFound();

  const finished = activity.status === "finished";
  const bill = splitBill.activityId === id ? splitBill : null;
  // Stand-in until real ratings exist: use the authors of this activity's moments.
  const raters = finished
    ? [...new Map(moments.filter((m) => m.activityId === id).map((m) => [m.author.id, m.author])).values()]
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>活动体验打分</CardTitle>
        </CardHeader>
        <CardContent>
          {finished ? (
            raters.length > 0 ? (
              <ul className="space-y-4">
                {raters.map((user) => (
                  <li key={user.id} className="flex items-center gap-4">
                    <Avatar className="size-8">
                      <AvatarFallback>{user.nickname.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{user.nickname}</span>
                    <span className="flex gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className="size-4 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">还没有人打分。</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              活动结束后才能打分。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>分账</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {bill ? (
            <>
              <p className="text-sm text-muted-foreground">
                总计 {formatCurrency(bill.total)}，共 {bill.shares.length} 人
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>成员</TableHead>
                    <TableHead className="text-right">应付</TableHead>
                    <TableHead className="text-right">已付</TableHead>
                    <TableHead className="text-right">差额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bill.shares.map((share) => {
                    const delta = share.paid - share.amount;
                    return (
                      <TableRow key={share.user.id}>
                        <TableCell className="font-medium">
                          {share.user.nickname}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(share.amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(share.paid)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {delta === 0
                            ? "—"
                            : delta > 0
                              ? `应收 ${formatCurrency(delta)}`
                              : `应付 ${formatCurrency(-delta)}`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                账单更新于 {formatDateTime(activity.createdAt)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              这个活动还没有账单。
            </p>
          )}
        </CardContent>
      </Card>

      <Placeholder>
        待接入：打分写入、账单录入、最少转账次数的结算算法（写入 Settlement）。
      </Placeholder>
    </div>
  );
}
