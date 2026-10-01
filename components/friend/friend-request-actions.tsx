"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  acceptFriendRequest,
  declineFriendRequest,
  withdrawFriendRequest,
} from "@/lib/friends/actions";

/**
 * 好友请求上的按钮：同意 / 拒绝（被添加的一方），以及撤回（发起的一方）。
 *
 * **为什么是 `startTransition` + 直接 await，不是 `<form action={…}>`。** 和
 * components/friend/relation-picker.tsx 同一个理由：拿到结果之后要 toast 一句，
 * 而 `<form action>` 那条路拿不到「回执到了」这个时刻（只能用一个 effect 盯着
 * state，那是一次 set-state-in-effect 的级联渲染）。这里也谈不上损失 —— 按钮
 * 是客户端交互，本来就要 JS。
 *
 * **授权不在这个文件里。** 传上去的 `requesterId` / `friendId` 是可以被篡改的；
 * 真正决定能不能动那一行的是服务端 WHERE 子句里的 `owner_id` / `friend_id`，而
 * 它们来自会话。这里做的只是把一个失败的结果如实告诉用户。
 *
 * **失败时只说「没处理上」。** 不区分「这个人没向你请求过」和「已经处理过了」——
 * 对一个正在试探别人 id 的人，不该给他更多信息。和 relation-picker 的措辞一致。
 */

type Decision = "accept" | "decline";

export function FriendRequestActions({
  requesterId,
  requesterName,
}: {
  /** 发起方的用户 id。不是 `friendships.id` —— 客户端指不了「一行」，只能指「一个人」。 */
  requesterId: string;
  requesterName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function respond(decision: Decision) {
    startTransition(async () => {
      const { ok } =
        decision === "accept"
          ? await acceptFriendRequest(requesterId)
          : await declineFriendRequest(requesterId);

      if (!ok) {
        toast.error("没处理上，请重试");
        return;
      }

      // 同意之后对方会出现在好友列表里，**不带 `new`** —— 是我点的同意，服务端不会
      // 给我一条自我通知（见 lib/friends/dal.ts 里 `sealFriendship` 的 `selfSeen`）。
      // 所以那句 toast 不只是「办完了」，它是这边唯一的确认。
      toast(
        decision === "accept"
          ? `已和${requesterName}成为好友`
          : `已拒绝${requesterName}的好友请求`,
      );
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() => respond("accept")}
      >
        同意
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => respond("decline")}
      >
        拒绝
      </Button>
    </div>
  );
}

export function WithdrawRequestButton({
  friendId,
  friendName,
}: {
  /** 当初想加的那个人。 */
  friendId: string;
  friendName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function withdraw() {
    startTransition(async () => {
      const { ok } = await withdrawFriendRequest(friendId);

      if (!ok) {
        toast.error("没撤回成，请重试");
        return;
      }

      toast(`已撤回发给${friendName}的请求`);
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={withdraw}
    >
      撤回
    </Button>
  );
}
