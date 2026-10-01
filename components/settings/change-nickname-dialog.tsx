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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateNickname } from "@/lib/auth/actions";
import { SETTINGS_FORM_INITIAL } from "@/lib/auth/form-state";
import { NICKNAME_MAX_LENGTH } from "@/lib/validation";

/**
 * 改昵称。
 *
 * **不走 `useActionState`，走 `startTransition` + 直接 await。** 对话框要在拿到回执之后
 * 自己关上，而 `<form action={formAction}>` 那条路拿不到「回执到了」这个时刻 —— 只能用一个
 * effect 盯着 state，再在 effect 里 setState，那是一次多余的级联渲染，也是 react-hooks 的
 * set-state-in-effect 明确拦下来的写法。完整理由写在
 * components/friend/add-friend-dialog.tsx 里，这里是同一个套路。
 *
 * **复位时机和 `AddFriendDialog` 正好相反，这不是抄漏了。** 那个框里装的是**别人的**手机号，
 * 所以要「关上就清干净，别把上一个人的号码留给下一个人看」；这个框里装的是**用户自己的**
 * 当前昵称，而且改名成功后布局会重渲染、传进来的 `current` 已经变了 —— 所以正确的复位点是
 * **打开时**：用最新的 `current` 填上，顺手把上一次的错误清掉。改成关掉时清空，用户每次
 * 都要重打一遍自己的名字。
 *
 * **客户端不做格式预检**（不写 `maxLength`、不本地调 `checkNickname`）：规则只在
 * lib/validation.ts 一处，在这里抄第二份迟早会分叉。代价是一个明显超长的名字也要走一次
 * 往返，而那是本机 Postgres 的一次 UPDATE。
 */
export function ChangeNicknameDialog({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(current);
  const [state, setState] = useState(SETTINGS_FORM_INITIAL);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const next = await updateNickname(state, formData);

      if (next.ok) {
        setOpen(false);
        toast("昵称已更新");
        return;
      }

      setState(next);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(willOpen) => {
        setOpen(willOpen);

        if (willOpen) {
          setNickname(current);
          setState(SETTINGS_FORM_INITIAL);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="w-full" />}>
        修改昵称
      </DialogTrigger>
      <DialogContent>
        <form action={submit}>
          <DialogHeader>
            <DialogTitle>修改昵称</DialogTitle>
            <DialogDescription>
              {`昵称是好友看到的名字，最多 ${NICKNAME_MAX_LENGTH} 个字符。可以和别人重名。`}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field data-invalid={state.nicknameError ? true : undefined}>
              <FieldLabel htmlFor="settings-nickname">昵称</FieldLabel>
              <Input
                id="settings-nickname"
                name="nickname"
                autoComplete="nickname"
                value={nickname}
                aria-invalid={state.nicknameError ? true : undefined}
                onChange={(e) => setNickname(e.target.value)}
              />
              <FieldError>{state.nicknameError}</FieldError>
            </Field>

            {/* 表单级错误，不属于任何一个字段。`renameUser` 返回 false 那种落在这里。 */}
            <FieldError>{state.formError}</FieldError>
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
