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
                {/* 右边那 5 颗星是固定的 88px（5×16 + 4×2），头像 size-8 也固定；
                    两头的固定宽度加起来，在 320px 的卡片里会把昵称挤出去 —— 而
                    `Card` 是 overflow-hidden，溢出就成了**看不见的截断**。
                    `min-w-0` 让昵称可被压缩，`truncate` 让压缩表现为省略号，
                    两个固定项加 `shrink-0` 保证先挤的是昵称而不是星星。 */}
                {raters.map((user) => (
                  <li key={user.id} className="flex items-center gap-4">
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback>{user.nickname.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 truncate text-sm font-medium">
                      {user.nickname}
                    </span>
                    <span className="flex shrink-0 gap-0.5">
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
              {/* 四列在 320px 下最小内容宽约 580px，而卡片里只有约 240px。表格外面
                  那层是 `overflow-x-auto`（table.tsx:10），所以整页不会被撑出横向
                  滚动 —— 代价是最右边那列**整列看不见**，且没有任何提示。
                  手机宽度下只留真正的行动项：谁 + 差多少。应付/已付是推导差额的中间
                  量，`sm:` 以上再出现。 */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>成员</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      应付
                    </TableHead>
                    <TableHead className="hidden text-right sm:table-cell">
                      已付
                    </TableHead>
                    <TableHead className="text-right">差额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bill.shares.map((share) => {
                    const delta = share.paid - share.amount;
                    return (
                      <TableRow key={share.user.id}>
                        {/* 昵称最长 20 字（约 280px），而 `TableCell` 默认
                            `whitespace-nowrap` —— 不放开换行，光这一列就把表撑破。 */}
                        <TableCell className="font-medium wrap-break-word sm:whitespace-nowrap">
                          {share.user.nickname}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
                          {formatCurrency(share.amount)}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums sm:table-cell">
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
