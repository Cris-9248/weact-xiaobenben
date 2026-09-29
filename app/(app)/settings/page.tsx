import { PageHeader, Placeholder } from "@/components/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ActivityTypeManager } from "@/components/activity/activity-type-manager";
import { ThemeToggle } from "@/components/theme-toggle";
import { me } from "@/lib/mock-data";

export const metadata = { title: "我的" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="我的" />

      <Card>
        <CardContent className="flex items-center gap-4 py-6">
          <Avatar className="size-14">
            <AvatarFallback className="text-lg">
              {me.nickname.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-heading text-lg font-semibold">{me.nickname}</p>
            <p className="text-sm text-muted-foreground">{me.phone}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>账号</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Row label="昵称" value={me.nickname} />
          <Separator />
          <Row label="手机号" value={me.phone} />
          <Separator />
          <Row label="密码" value="已设置" />
          {/* `flex-wrap` matters at 320px: the three buttons total ~236px and the
              card's content box is ~256px, and `Card` is overflow-hidden — so
              without wrapping the last one gets clipped instead of moving down. */}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm">
              修改昵称
            </Button>
            <Button variant="outline" size="sm">
              修改密码
            </Button>
            <Button variant="ghost" size="sm">
              退出登录
            </Button>
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

      <Placeholder>
        待接入：资料更新与密码修改的 Server Action；退出登录必须用
        window.location.href 跳转，否则客户端状态会残留。
        活动类型目前只存在本机浏览器，接入后端后会随账号同步。
      </Placeholder>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
