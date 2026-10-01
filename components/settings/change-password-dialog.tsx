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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updatePassword } from "@/lib/auth/actions";
import { SETTINGS_FORM_INITIAL } from "@/lib/auth/form-state";
import { PASSWORD_RULES } from "@/lib/validation";

/** 规则文案只在 lib/validation.ts 一处，这里从它拼出来，不抄第二份。 */
const PASSWORD_RULE_TEXT = Object.values(PASSWORD_RULES).join("；");

/**
 * 改密码。
 *
 * 骨架和复位时机的取舍同 components/settings/change-nickname-dialog.tsx
 * （`startTransition` + 直接 await；客户端不做格式预检）。
 *
 * **这一个连关闭时也要清。** 昵称框里装的是用户自己的名字，留着无所谓；这里装的是
 * 明文密码，对话框关掉之后没有理由让它继续躺在 React state 里。所以 `onOpenChange`
 * 两个方向都复位 —— 关上是为了抹掉，打开是为了保证永远是空白开局（中途按 Esc、
 * 或者被点遮罩关掉，都不会留下上一次的残值）。
 *
 * **三个框的 `autoComplete` 是功能的一部分，不是装饰。** `current-password` 让密码
 * 管理器认出「这是旧密码」；`new-password` 是它提供「生成强密码 / 更新已存密码」的
 * 唯一触发条件 —— 都写成 `password` 的话，iOS 和各家管理器会在这里给出错的那一套
 * 建议（拿旧密码去填新密码框）。
 */
export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState(SETTINGS_FORM_INITIAL);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await updatePassword(state, formData);

      if (result.ok) {
        // 不能省成「密码已修改」：其他设备被静默踢下线是这次操作真正的另一半，
        // 而界面上没有第二个地方能看到它 —— 不说，用户就永远不知道。
        setOpen(false);
        toast("密码已修改，其他设备需要重新登录");
        return;
      }

      setState(result);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(willOpen) => {
        setOpen(willOpen);
        setCurrent("");
        setNext("");
        setConfirm("");
        setState(SETTINGS_FORM_INITIAL);
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="w-full" />}>
        修改密码
      </DialogTrigger>
      <DialogContent>
        <form action={submit}>
          <DialogHeader>
            <DialogTitle>修改密码</DialogTitle>
            <DialogDescription>
              改完之后，其他设备需要重新登录；这台保持登录。
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field data-invalid={state.currentPasswordError ? true : undefined}>
              <FieldLabel htmlFor="settings-current-password">
                当前密码
              </FieldLabel>
              <Input
                id="settings-current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={current}
                aria-invalid={state.currentPasswordError ? true : undefined}
                onChange={(e) => setCurrent(e.target.value)}
              />
              <FieldError>{state.currentPasswordError}</FieldError>
            </Field>

            <Field data-invalid={state.newPasswordError ? true : undefined}>
              <FieldLabel htmlFor="settings-new-password">新密码</FieldLabel>
              <Input
                id="settings-new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                value={next}
                aria-invalid={state.newPasswordError ? true : undefined}
                onChange={(e) => setNext(e.target.value)}
              />
              <FieldDescription>{PASSWORD_RULE_TEXT}</FieldDescription>
              <FieldError>{state.newPasswordError}</FieldError>
            </Field>

            <Field data-invalid={state.confirmPasswordError ? true : undefined}>
              <FieldLabel htmlFor="settings-confirm-password">
                确认新密码
              </FieldLabel>
              <Input
                id="settings-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirm}
                aria-invalid={state.confirmPasswordError ? true : undefined}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <FieldError>{state.confirmPasswordError}</FieldError>
            </Field>

            {/* 表单级：限流那条落在这里，它不属于任何一个字段。 */}
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
