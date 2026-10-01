"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signOut } from "@/lib/auth/actions";

/**
 * 退出登录，带一次二次确认。
 *
 * **为什么加了确认。** 原先的判断是「退出是这一页最常见的动作，而且可逆，不值得拦一下」，
 * 所以只靠 `ghost` 变体和 `pt-2` 的间距防误触。用户 2026-10-01 要求补上确认框 ——
 * 这个位置就在「修改昵称 / 修改密码」下面，三个全宽按钮竖排，手指落错一行的代价是
 * 被踢回登录页再输一遍手机号密码。可逆不等于没有代价。
 *
 * **确认框复用 `components/ui/dialog.tsx`**：仓库里没有 `alert-dialog.tsx`，这是既有
 * 做法（先例见 components/friend/delete-friend-button.tsx 和
 * components/activity/activity-type-manager.tsx 的 DeleteDialog）。骨架也照抄
 * `DeleteFriendButton`：受控 `open` + 一个普通触发按钮，不用 `DialogTrigger`。
 *
 * **确认那一下仍然是 `<form action={signOut}>`，不是 onClick。** 理由见
 * lib/auth/actions.ts 的 `signOut` —— 退出是改状态的操作，只有 POST 语义才对。
 * form 放在 `DialogContent` 里，所以它在 portal 里和它的提交按钮待在一起，
 * 不需要靠 `form="id"` 跨 portal 关联。
 *
 * **代价要说清楚：禁用 JS 时这条路走不通了。** 原先那个裸的 form 提交在无 JS 时
 * 照样能用，现在弹窗本身要 JS 才打得开 —— `signOut` 的 docblock 里已经改了措辞，
 * 别把它当成还能用的保证。
 *
 * **文案里的「其他设备不受影响」是这句确认真正要说的信息。** 同一个页面上，改密码
 * 会把其他设备全部踢下线，退出登录只清这一台 —— 两件事相邻，不写清楚用户分不出
 * 哪个是哪个。
 */
export function SignOutButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        退出登录
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>退出登录？</DialogTitle>
            <DialogDescription>
              退出后需要重新用手机号和密码登录。只清除这台设备上的登录状态，其他设备不受影响。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            {/* `w-full`：`DialogFooter` 在窄屏是 `flex-col-reverse`，两侧默认拉伸，
                少了它确认按钮会缩成内容宽，和上面那颗「取消」对不齐。 */}
            <form action={signOut}>
              <Button type="submit" className="w-full">
                退出登录
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
