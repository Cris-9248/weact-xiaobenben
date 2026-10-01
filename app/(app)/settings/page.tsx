import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityTypeManager } from "@/components/activity/activity-type-manager";
import { ChangeNicknameDialog } from "@/components/settings/change-nickname-dialog";
import { ChangePasswordDialog } from "@/components/settings/change-password-dialog";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireSessionUser } from "@/lib/auth/session";

export const metadata = { title: "我的" };

export default async function SettingsPage() {
  // 自己读，不靠布局 —— 布局拦不住同层页面渲染。这一次调用和布局那次共用
  // 同一个请求级缓存，不额外查库。
  const user = await requireSessionUser();

  return (
    <div className="space-y-6">
      <PageHeader title="我的" />

      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">
              {user.nickname.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          {/* `min-w-0` + `truncate`：昵称最长 20 字，而 `Card` 是 `overflow-hidden`
              （card.tsx:14），缺了这两个类，溢出会变成**看不见的截断**而不是滚动条。
              头像 `size-14` 是固定宽度，`min-width: auto` 会撑着这一行不收缩。 */}
          <div className="min-w-0">
            <p className="font-heading truncate text-lg font-semibold">
              {user.nickname}
            </p>
            <p className="text-sm text-muted-foreground">{user.phone}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>外观</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">主题</p>
              <p className="text-xs text-muted-foreground">
                温馨是暖色浅调，冷酷是冷色深调，商务是黑白灰的克制配色。选择会保存在本机。
              </p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      <ActivityTypeManager />

      {/* 页尾三件事。**没有卡片包着** —— 用户要的就是「不要『账号』那一栏」，
          再套一个无名卡片只是换个壳；而且卡片那 32px 的内边距正是 320px 下最紧张的
          东西（原来那三个 sm 按钮就是被它挤到换行才没被裁掉）。
          三个按钮**全宽竖排**：原来的横排三个共约 236px，320px 下只能靠 `flex-wrap`
          勉强不溢出，换行之后每行宽度还不一样。竖排没有这个问题。
          变体沿用现状：两个开框的 `outline`，退出登录 `ghost`（视觉上退后一层，
          但没有用 `destructive` —— 退出不丢任何数据）。 */}
      <div className="space-y-2">
        <ChangeNicknameDialog current={user.nickname} />
        <ChangePasswordDialog />
        {/* 退出**要二次确认**（用户 2026-10-01 要求）：它就排在改昵称、改密码下面，
            三个全宽按钮竖排，手指落错一行就被踢回登录页。理由和实现见
            components/settings/sign-out-button.tsx。 */}
        <div className="pt-2">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
