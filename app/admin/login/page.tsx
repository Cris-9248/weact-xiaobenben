import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminLoginForm } from "@/components/admin/login-form";

/**
 * 管理员登录页。
 *
 * 这一页**必须**是 Server Component，表单在 `components/admin/login-form.tsx`。
 * `"use client"` 的模块不能导出 `metadata`，而这一页需要 `robots: noindex` ——
 * 和 `/admin` 一样。拆开的代价是一个文件，换来的是不必为此加一个 layout：有了
 * layout，下一个人就会本能地把闸门放进 layout，而 layout 根本不是授权边界
 * （见 app/admin/page.tsx 顶部的注释）。
 *
 * 页面本身不需要闸门：未登录的人本来就该看到它。
 */
export const metadata = {
  title: "管理员登录",
  robots: { index: false },
};

export default function AdminLoginPage() {
  return (
    // `px-4` 和其余每个独立页面一致（app/admin/page.tsx:72、app/s/[token]/page.tsx:49、
    // app/error.tsx:18、app/(auth)/layout.tsx:9）。少了它，`max-w-sm` 在 320px 下
    // 就等于满宽，卡片直接贴着屏幕边 —— 这是全应用唯一一个没有左右内边距的页面。
    <div className="mx-auto w-full max-w-sm px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>管理员登录</CardTitle>
          <CardDescription>仅供管理使用。</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminLoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
