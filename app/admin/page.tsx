import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminSignOut } from "@/lib/admin/actions";
import { listUsers } from "@/lib/admin/dal";
import { isAdmin } from "@/lib/admin/session";
import { formatDate } from "@/lib/format";

export const metadata = {
  title: "用户管理",
  // 这一页列着所有人的手机号。它没有理由出现在任何搜索结果里。
  robots: { index: false },
};

/**
 * 管理员：用户列表。只读。
 *
 * ## 闸门为什么在这里，而不是在 layout 里
 *
 * 直觉做法是加一个 `app/admin/layout.tsx` 做 `if (!isAdmin()) redirect(...)`。
 * 那是错的，而且错得不明显：
 *
 *   - **layout 不控制其余路由段是否渲染。** 官方文档写得很直白（见
 *     node_modules/next/dist/docs/01-app/02-guides/authentication.md）：
 *     路由段和并行路由槽是由 router 渲染的，一个「拦住」它们的 layout 并不会
 *     阻止它们运行，也不会阻止它们出现在 RSC Payload 里。layout 里那次
 *     `redirect()` 拦住的只是 layout 自己的渲染。
 *   - **Route Handler 根本不走 layout。** 哪天有人往这个目录加一个
 *     `route.ts`（导出用户列表的 CSV 是很自然的下一步），它返回的是 Response，
 *     一次 layout 都不会经过 —— 而加它的人会以为自己站在闸门后面。
 *   - **Next 应用有多个入口。** `/admin` 这个页面本身只是其中之一。
 *
 * 所以检查放在**离数据最近的地方**：这个页面自己，在调用 `listUsers()` 之前。
 * 这也是 CLAUDE.md 里那条「页面级检查只管渲染，action 要自己鉴权」的同一原则
 * —— 这里的「数据源」就是这个页面。
 *
 * ## 以后往这里加东西的人请注意
 *
 * **这个页面不定义任何 Server Action，所以它今天不需要别的授权。** 渲染闸门
 * 就是全部边界，因为没有任何可被单独 POST 的端点。这个性质是**故意**的，不是
 * 疏忽：
 *
 *   - 要加 **写操作**（删用户、重置密码），必须写成 Server Action，而每个
 *     action 都要**自己**再跑一次 `isAdmin()`。页面顶部的检查对 action 无效
 *     —— action 是一个能直接 POST 的独立端点。
 *   - 要加 **Route Handler**，同上，它不走这个页面。
 *   - 要加 **子页面**，它不经过这个文件，得自己检查。`lib/admin/dal.ts` 是个
 *     裸模块，它不挡任何人。
 */
export default async function AdminUsersPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const users = await listUsers();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <PageHeader
        title="用户管理"
        description={`共 ${users.length} 个账号。`}
        action={
          // 和用户侧退出一样包在 form 里：退出是改状态的操作，只有 POST
          // 语义才对，GET 链接会被预取、被爬虫顺手打开然后把人登出。
          <form action={adminSignOut}>
            <Button type="submit" variant="outline" size="sm">
              退出登录
            </Button>
          </form>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>全部用户</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>还没有用户</EmptyTitle>
                <EmptyDescription>
                  有手机号在登录页注册之后，账号会出现在这里。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            // 四列在 320px 下最小内容宽约 350px，而 `CardContent` 里只有约 240px。
            // 表格外面那层是 `overflow-x-auto`（table.tsx:10），所以整页不会被撑出
            // 横向滚动 —— 代价是右边两列**要靠横滑才看得到**，而没有任何提示说明
            // 还有东西在右边。手机宽度下只留真正要看的「谁 + 号码」，
            // `sm:` 以上四列齐全。
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>昵称</TableHead>
                  <TableHead>手机号</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    注册时间
                  </TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    有效会话
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    {/* 昵称可以长到 20 字（约 280px），而 `TableCell` 默认
                        `whitespace-nowrap` —— 不放开换行的话，光这一列就把表撑破，
                        上面藏掉的列又白藏了。 */}
                    <TableCell className="font-medium wrap-break-word sm:whitespace-nowrap">
                      {user.nickname ?? (
                        // 昵称可空是设计的一部分：手机号登录即建号，昵称是之后的
                        // 一步。所以这不是坏数据，是「注册还没走完」。
                        <span className="text-muted-foreground">
                          未完成注册
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {user.phone}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(user.createdAt.toISOString())}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {user.activeSessionCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
