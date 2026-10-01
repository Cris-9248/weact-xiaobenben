"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RELATIONS, RELATION_LABEL, isRelationKind } from "@/lib/constants";
import { addFriend } from "@/lib/friends/actions";
import { ADD_FRIEND_INITIAL } from "@/lib/friends/form-state";
import type { RelationKind } from "@/lib/types";

/**
 * 添加好友。
 *
 * **手机号是受控字段，不是 defaultValue。** React 19 在表单 action 返回后会重置
 * 表单里的非受控字段 —— 用 `defaultValue` 的话，用户输错一次、服务端回一条
 * phoneError，输入框会自己清空，得重打一遍。受控字段由 state 说了算，不受这次
 * 重置影响。
 *
 * **客户端不做格式预检。** 服务端的 `addFriend` 已经 `normalizePhone` +
 * `isValidPhone` 了，这里再判一次只是把同一套规则抄成两份，迟早会分叉。代价是
 * 一个明显不合法的号码也要走一次往返，而那是本机 Postgres 的一次查询。
 *
 * **不走 `useActionState`，走 `startTransition` + 直接 await。** 对话框要在拿到
 * 回执之后自己关上，而 `<form action={formAction}>` 那条路拿不到「回执到了」这个
 * 时刻 —— 只能用一个 effect 盯着 state，再在 effect 里 setState。那是一次多余的
 * 级联渲染，也是 react-hooks 的 set-state-in-effect 明确拦下来的写法。直接 await
 * 到结果、就地关掉，少一步，也读得出来。和 components/friend/relation-picker.tsx
 * 是同一个套路。
 *
 * 代价：这样写就没有「禁用 JS 也能提交」了。但对话框的开合本来就由 React state
 * 控制，没 JS 它根本打不开 —— 那份能力在这里是白给的，换来的是上面那条。
 *
 * **几种结果一视同仁地关上对话框。** `notice` 的文案对「请求已发出」「号码没注册」
 * 「对方还没取名」「本来就是好友」是同一个字符串（理由见 lib/friends/actions.ts），
 * 界面**分辨不出**成功与失败，也就不该表现得像分辨得出。要读那句话看 toast。
 *
 * 发出请求之后，界面上唯一的反馈是好友页里那张「等待对方同意」—— 对话框这边说不
 * 出更多，别在这里加「已发送」之类的确认，那会把上面那条保证拆掉一半。
 */
export function AddFriendDialog() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState<RelationKind>("friend");
  const [state, setState] = useState(ADD_FRIEND_INITIAL);
  const [isPending, startTransition] = useTransition();

  /** 关上就清干净，不要把上一个人的号码留在框里给下一个人看。 */
  function reset() {
    setPhone("");
    setRelation("friend");
    setState(ADD_FRIEND_INITIAL);
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const next = await addFriend(state, formData);

      if (next.notice) {
        toast(next.notice);
        setOpen(false);
        reset();
        return;
      }

      // 走到这里只有一种可能：号码格式不对，或加的是自己。两者都不泄漏
      // 「这个号码注册过没有」，所以可以放心显示在输入框下面。
      setState(next);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // 用户按 Esc 或点遮罩关掉时走的是这条路，不是 submit 里那次 setOpen。
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button />}>
        <UserPlus data-icon="inline-start" />
        添加好友
      </DialogTrigger>
      <DialogContent>
        <form action={submit}>
          <DialogHeader>
            <DialogTitle>添加好友</DialogTitle>
            <DialogDescription>
              输入对方的手机号发送好友请求，对方同意后你们成为好友。关系标注只有你自己能看到。
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field data-invalid={state.phoneError ? true : undefined}>
              <FieldLabel htmlFor="friend-phone">手机号</FieldLabel>
              <Input
                id="friend-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                placeholder="请输入正确的手机号"
                value={phone}
                aria-invalid={state.phoneError ? true : undefined}
                onChange={(e) => setPhone(e.target.value)}
              />
              <FieldError>{state.phoneError}</FieldError>
              <FieldDescription>
                对方必须已经注册 Weact小本本。
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="friend-relation">关系</FieldLabel>
              <Select
                // **这一行是「收起后显示英文」的修复。** 不给 `items`，Base UI 的
                // <SelectValue> 渲染的是**原始值**（"friend"），而不是选项里那句
                // 中文 —— 于是同一件事，展开时是「好友」，收起后是 "friend"。
                // 传一张 value → label 的表进去，它才去查标签。
                // （`items` 直接收 `RELATION_LABEL`，所以以后改文案不用碰这里。）
                items={RELATION_LABEL}
                // 原生表单集成。它会自己渲染一个 `type="hidden"` 的 input，
                // 值是序列化后的 value（还是 "friend"）而不是 label —— 服务端
                // 要的正是这个，用 RELATIONS 白名单再校一次（这一列是 text 不是
                // 数据库 enum，那里是唯一的把关点）。所以不需要手写隐藏字段。
                name="relation"
                value={relation}
                // 用白名单守一遍而不是 `as RelationKind`：下拉只会发出 RELATIONS
                // 的成员，所以走不到 false 分支，这里的作用是免掉一次强制转换。
                onValueChange={(next) => {
                  if (isRelationKind(next)) setRelation(next);
                }}
              >
                <SelectTrigger id="friend-relation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {RELATION_LABEL[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "添加中…" : "添加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
