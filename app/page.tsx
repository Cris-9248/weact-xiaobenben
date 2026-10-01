import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";

/**
 * 根路径只做分流，没有自己的内容：活动列表才是这个应用的主页。
 *
 * 昵称还空着的人不能直接进 /activities —— 不是在这里拦，而是分流到补昵称页。
 * 真正的闸门在 `(app)/layout.tsx`，这里只是让第一次访问的落点正确，省掉一次
 * 「进了主页又被弹回来」的往返。
 */
export default async function Home() {
  const user = await getSessionUser();

  if (!user) redirect("/login");
  redirect(user.nickname ? "/activities" : "/register/password");
}
