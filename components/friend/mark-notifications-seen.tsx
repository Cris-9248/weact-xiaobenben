"use client";

import { useEffect } from "react";

import { markNotificationsSeen } from "@/lib/friends/actions";

/**
 * 进好友页时把「已同意」的通知标记为看过。没有 UI。
 *
 * **为什么是「挂载后触发一个 action」而不是「渲染时写库」。** 渲染必须是只读的
 * （CLAUDE.md 明令；lib/auth/session.ts 也宁可留着过期的会话行不在读取路径上写）。
 * 而写在这里的话，还有第二个理由：`app/` 下现在没有任何 `loading.tsx`，所以
 * `/friends` 作为 dynamic 路由**今天**不会被预取，渲染只发生在真实访问时。但只要
 * 有人给 (app) 组加一个 `loading.tsx`（一个常规改动），dynamic 路由的预取就打开了，
 * 悬停侧栏就会渲染页面 —— 渲染期写入会在用户真正到达之前把一切都标成已看过。
 *
 * **为什么标记发生在这一次访问，而 `new` 标记还能留着。** 服务端渲染这一页时读到的
 * 还是 `seenAt IS NULL`，所以标记画得出来；这个 action **不调 `revalidatePath`**，
 * 于是它不会带回一份重渲染的页面，标记就活满这次访问。下一次进好友页是一次真实的
 * 服务端往返，那时读到的值已经写好了。理由的完整版写在 `markNotificationsSeen`
 * 那个 action 上，值得一读再改这里。
 *
 * **父级要给它一个 key。** 这个组件只在整个页面没有任何未读时才不渲染，所以一旦
 * 挂载就不会重挂 —— 而这一页上确实可能产生新的未读边（互发请求、或别人在这期间
 * 同意了我），那条边就没有东西去标记了。钥匙是未读集合的签名，集合一变就重挂、
 * 重发一次。
 *
 * 同意**别人**的请求不会走这条路：那种情况下我自己那一行出生就是已读的
 * （`lib/friends/dal.ts` 里 `sealFriendship` 的 `selfSeen`，2026-10-01 起），
 * 未读集合根本没变，也就没有东西要标记。
 *
 * 开发模式下 React StrictMode 会把 effect 跑两遍，于是发两次 POST。`markSeen` 的
 * WHERE 里带了 `seen_at is null`，所以第二次是空操作。生产模式只会跑一次。
 */
export function MarkNotificationsSeen() {
  useEffect(() => {
    // `void` 而不是 await：这是一个后台动作，不阻塞任何东西。它失败时什么都不
    // 会发生 —— 通知保持未读，下次进这一页再标一次。过度通知是安全的方向，
    // 所以这里不需要给用户报错。
    void markNotificationsSeen();
  }, []);

  return null;
}
