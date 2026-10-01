"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { removeFriend } from "@/lib/friends/actions";

/**
 * 删除一个好友。**单边删除 = 双边删除**：删掉之后我和 Ta 会互相从对方的好友列表里
 * 消失，而对方不会收到任何通知（理由见 lib/friends/dal.ts 的 `deleteFriendship`）。
 *
 * **为什么要二次确认。** 这个动作不可撤销，而且影响的不只是点按钮的这个人。确认框
 * 复用 `components/ui/dialog.tsx` —— 仓库里没有 alert-dialog.tsx，这是既有做法
 * （另一个先例见 components/activity/activity-type-manager.tsx 的 DeleteDialog）。
 *
 * **为什么不用 `useOptimistic`。** 骨架来自 friend-request-actions.tsx 的
 * `WithdrawRequestButton`：`useTransition` + 直接 await + `{ok}` 决定 toast。
 * relation-picker.tsx 里那套乐观值是给「改一行里的一个字段」用的 —— 它有一个可以
 * 落回去的 prop。这里没有可回滚的中间态：服务端一个 `revalidatePath("/friends")`
 * 就把整张卡移除了，那比任何乐观更新都干净。**反过来说，`removeFriend` 里那句
 * revalidate 是不能省的**，省掉的话卡片会在 transition 结束时弹回来。
 *
 * **授权不在这个文件里。** 传上去的 `friendId` 可以被篡改；真正决定能不能删的是服务端
 * WHERE 子句里那条「我确实有一条指向 Ta 的 accepted 边」，而「我」来自会话。
 *
 * 失败时只说「没删成」。不区分「你们本来就不是好友」和「对方先把你删了」—— 沿用
 * friend-request-actions.tsx 那条既有的措辞规则。
 */
export function DeleteFriendButton({
  friendId,
  friendName,
}: {
  /** 对方的用户 id。不是 `friendships.id` —— 这个动作要动两行，只有一对用户 id 说得清。 */
  friendId: string;
  friendName: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const { ok } = await removeFriend(friendId);

      if (!ok) {
        toast.error("没删成，请重试");
        return;
      }

      // 先关框再 toast：这一句之后服务端会重渲染，这张卡连同这个组件一起消失，
      // 留着 open 也没有东西可显示了。
      setOpen(false);
      toast(`已删除好友${friendName}`);
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        data-slot="delete-friend-trigger"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        删除
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除好友？</DialogTitle>
            {/* 用模板字符串而不是 `你和{friendName}会…`：JSX 会把换行和缩进折成一个
                空格，那会在昵称后面多出一个「你 会」。 */}
            <DialogDescription>
              {`删除后你和${friendName}会互相从好友列表中消失，对方不会收到通知。这个操作不能撤销。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" disabled={isPending} onClick={confirm}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
