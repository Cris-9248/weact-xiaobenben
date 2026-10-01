"use server";

import { redirect } from "next/navigation";

import { verifyAdminCredentials } from "./credentials";
import type { AdminFormState } from "./form-state";
import { createAdminSession, destroyAdminSession } from "./session";

/**
 * 管理员登录 / 登出。
 *
 * **这个文件里没有一处 try/catch**，和 `lib/auth/actions.ts` 一样：`redirect()`
 * 是靠抛异常中断的，任何一层 catch 都会把它吞掉，表现是「登录成功但页面不动」。
 */

/**
 * 管理员登录。这是整个功能唯一的未鉴权入口。
 *
 * 页面那一侧的闸门（`app/admin/page.tsx` 顶部的 `isAdmin()`）决定的是「能不能
 * 看到这个页面」；这里决定的是「能不能拿到那个身份」。两者不是一回事，也不
 * 能互相替代 —— 这个 action 是一个任何人都能直接 POST 的端点，它自己必须
 * 完成全部校验。
 *
 * 配置缺失和口令错误返回**同一条消息**。区分开来就等于告诉调用方「这个部署
 * 还没设置管理员口令」，那是一条不该存在的探测通道。真正的排障信息由
 * `verifyAdminCredentials` 记在服务端日志里。
 */
export async function adminSignIn(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (username.length === 0) {
    return { usernameError: "请输入用户名" };
  }
  if (password.length === 0) {
    return { passwordError: "请输入密码" };
  }

  // 只有验过了才会拿到这串摘要。详见 credentials.ts —— 那里刻意没有暴露
  // 「直接取当前指纹」的函数，就是为了让「没验凭据却拿到指纹」在类型上不存在。
  const fingerprint = await verifyAdminCredentials(username, password);
  if (!fingerprint) {
    return { formError: "用户名或密码不对" };
  }

  await createAdminSession(fingerprint);
  redirect("/admin");
}

/**
 * 管理员登出。
 *
 * 和用户侧一样必须挂在 `<form action={adminSignOut}>` 上，不能是 onClick 或
 * `<Link>`：退出是改状态的操作，GET 语义下会被预取、被爬虫顺手打开然后把人
 * 登出。挂在 form action 上还顺带让禁用 JS 时原生提交照样能用。
 *
 * 不是管理员时调用也是安全的 —— 没有 cookie 时 `destroyAdminSession` 只清一个
 * 本来就不存在的 cookie，不会出错。
 */
export async function adminSignOut(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}
