"use client";

import { useOptimistic, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RELATIONS, RELATION_LABEL, isRelationKind } from "@/lib/constants";
import { setFriendRelation } from "@/lib/friends/actions";
import type { RelationKind } from "@/lib/types";

/**
 * 关系标注只对自己可见，改这里不会影响对方看到的关系。
 *
 * **为什么是 `startTransition` 而不是 `<form action={…}>`。** 这个控件是个下拉
 * 菜单，本身就依赖 JS —— 为一个已经依赖 JS 的控件追求「禁用 JS 可用」没有意义。
 * 真要那样，得先把它换成原生 `<select>`。既然放弃了那一头，就换来这一头：
 * 乐观更新。选中的项立刻变，请求在后台走，失败了再回滚。
 *
 * **为什么是 `useOptimistic` 而不是 `useState` + 手工回滚。** 手工回滚得在点击
 * 那一刻把旧值抄下来（`const previous = relation`），于是失败时回滚到的是**点击
 * 时**的旧值，而不是服务端现在的值 —— 连点两次、前一次失败后一次成功时，那次
 * 失败的回滚会盖掉成功的结果。`useOptimistic` 的底值是这个组件的 `relation`
 * prop，也就是服务端最近一次说的值，回滚自然落在正确的地方；React 也顺带处理了
 * 并发更新的顺序，不用自己判。
 *
 * 代价是这里不再持有状态：`relation` 必须真的随 revalidate 更新，否则乐观值会
 * 在 transition 结束时弹回原样。这正是 Server Action 里 `revalidatePath("/friends")`
 * 必须在返回前发生的原因。
 *
 * **授权不在这个文件里，也不该在。** 传上去的 `friendshipId` 是可以被篡改的；
 * 真正决定能不能改的是服务端那个 WHERE 子句里的 `ownerId`，而它来自会话。
 * 这里做的只是把一个失败的结果如实告诉用户。
 */
export function RelationPicker({
  friendshipId,
  friendName,
  relation,
}: {
  /** 好友边自己的 id。没有它就够不到那一行 —— 光有名字是不够的。 */
  friendshipId: string;
  friendName: string;
  /** 服务端最近一次渲染时的值，同时充当乐观值的底。 */
  relation: RelationKind;
}) {
  const [optimisticRelation, setOptimisticRelation] = useOptimistic(
    relation,
    (_current, next: RelationKind) => next,
  );
  const [, startTransition] = useTransition();

  function change(next: string) {
    // 顺手用白名单把类型收窄。下拉菜单只会发出 RELATIONS 的成员，所以这个
    // 判断走不到 false 分支 —— 它在这里的作用是免掉一次 `as RelationKind`。
    if (!isRelationKind(next) || next === optimisticRelation) return;

    startTransition(async () => {
      // 必须在 transition 内部调用，否则 React 会警告「乐观更新发生在
      // transition 之外」—— 它需要有一个「结束」的时刻才知道什么时候回滚。
      setOptimisticRelation(next);

      const { ok } = await setFriendRelation(friendshipId, next);

      if (ok) {
        toast(`已把${friendName}标为${RELATION_LABEL[next]}`);
      } else {
        // 不报「这不是你的好友」之类的话。对用户来说，这就是一次没保存上；
        // 而对一个正在试探别人 friendshipId 的人，也不该给他更多信息。
        // 不用手动改回什么：transition 一结束，乐观值自动落回 prop。
        toast.error("没保存上，请重试");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            {RELATION_LABEL[optimisticRelation]}
            <ChevronDown data-icon="inline-end" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={optimisticRelation} onValueChange={change}>
          {RELATIONS.map((kind) => (
            <DropdownMenuRadioItem key={kind} value={kind}>
              {RELATION_LABEL[kind]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
