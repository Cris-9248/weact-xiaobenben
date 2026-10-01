import Link from "next/link";

import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import { ThemeToggle } from "@/components/theme-toggle";

/** Unauthenticated chrome: no nav, no shell — just a centred column. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-4">
      {/* 从 `fixed top-4 right-4` 改成随内容流排布。它原来是固定定位，图的是
          「不用打乱表单的垂直居中」，但在横屏（约 320×400）上表单会顶到接近屏幕
          顶部，这个按钮就正好压在登录卡片的右上角上 —— 挡住的还偏偏是那个位置
          最容易有的东西。
          放回流里之后它永远不会和卡片重叠，只是把整列往下推一点。

          这一行**故意不加 `max-w-sm`**（2026-10-01 用户要求）。收窄到卡片宽度的话，
          `justify-end` 靠的是卡片的右边缘 —— 宽屏上那就是屏幕中间偏右，而用户要的
          是画面右上方。整宽之后它落在屏幕右缘。
          移动端两种写法没有区别：卡片本来就是 `max-w-sm`，窄屏下两个右边缘重合。 */}
      <div className="flex w-full justify-end">
        <ThemeToggle variant="compact" />
      </div>
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-8 py-6">
        <Link href="/" className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-9 place-items-center rounded-xl bg-primary px-2.5 text-sm font-bold tracking-tight text-primary-foreground">
            We
          </span>
          <span className="space-y-1">
            <p className="font-heading text-2xl font-semibold tracking-tight">
              {APP_NAME}
            </p>
            <p className="block text-sm text-muted-foreground">{APP_TAGLINE}</p>
          </span>
        </Link>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
