import { AppShell } from "@/components/layout/app-shell";
import { requireSessionUser } from "@/lib/auth/session";
import { countFriendNotifications } from "@/lib/friends/dal";

/**
 * 登录后的路由。
 *
 * **这只是乐观闸门，不是授权边界。** 它决定"能不能看到这个壳子"，不决定
 * "能不能改这一行数据" —— 每一个 Server Action 仍然要自己重新读会话、自己
 * 确认那一行属于调用者。布局被绕过（或者哪天有人把某个页面挪出这个分组）时，
 * 唯一还站得住的就是 action 里那一次检查。
 *
 * 两道门（没会话 → /login；有会话但昵称还空着 → /register/password）现在长在
 * `lib/auth/session.ts` 的 `requireSessionUser` 里，**由每个页面自己调用**，
 * 这个布局也调 —— 但布局那次调用只是为了拿头像和昵称，不构成对页面的保护。
 *
 * 为什么不再在这里各自写一遍：布局拦不住同层页面的渲染，这是 Next 的既有行为，
 * 不是可以绕过的细节。闸门必须和它保护的数据待在一起。
 *
 * 注意读 cookie 会让这个分组下原本 `○ Static` 的页面全部变成 `ƒ Dynamic`。
 * 这是对的：这些页面本来就该按人渲染。`(auth)` 那两组没动，还是静态的。
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  // 这里读 user 只是为了让壳子能显示真实的人。**闸门不在这里生效** ——
  // 它在 requireSessionUser 里面，而每个页面都会自己调一次那个函数。
  const user = await requireSessionUser();

  // 侧栏徽标的数字。在布局里数，是因为徽标长在导航上 —— 它必须在这一组的每一页
  // 都出现，包括用户直接落在 /activities 的时候。
  //
  // 代价是**每个页面多两条 count 查询**。现在这是个位数用户的本地库，不值得为它
  // 建缓存；真要省，正确的动作是给这个函数套一层 React `cache()`（和
  // `getSessionUser` 同一个套路），而不是把徽标挪进好友页 —— 挪进去就等于接受
  // 「只有站在好友页上才看得见有几条」。
  //
  // 它和页面里那次 `listFriends` 是**两次独立查询**，不共用结果：布局和页面各渲染
  // 各的，一个要计数、一个要行。别试图把它们合成一次 —— 那要求布局知道页面的
  // 渲染形状。
  const friendNotifications = await countFriendNotifications(user.id);

  return (
    <AppShell user={user} friendNotifications={friendNotifications}>
      {children}
    </AppShell>
  );
}
