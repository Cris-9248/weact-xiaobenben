"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { completeRegistration } from "@/lib/auth/actions";
import { AUTH_FORM_INITIAL } from "@/lib/auth/form-state";

/**
 * 注册第二步：补昵称。账号和密码在上一步的登录页就已经处理掉了。
 *
 * 路径仍叫 `register/password`，但这一页已经不收密码了 —— 名字是历史遗留，
 * 保留只是为了这次不动文件结构（要改就是改目录名，引用点一处都没有了：
 * 现在没人 `router.push` 到这里，人是被 signIn 重定向送过来的）。
 *
 * 这一页不判断「我是谁」。身份在会话里，`completeRegistration` 自己去读；
 * 页面上没有任何地方能指定要改哪个账号。上一版这里在客户端先跑了一遍
 * `checkNickname`，现在删掉了，理由和登录页一样：校验只有一份，在服务端。
 */
export default function CompleteRegistrationPage() {
  const [state, formAction, isPending] = useActionState(
    completeRegistration,
    AUTH_FORM_INITIAL,
  );
  const [nickname, setNickname] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>取个昵称</CardTitle>
        <CardDescription>账号已创建，朋友们会看到这个名字。</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field data-invalid={state.nicknameError ? true : undefined}>
              <FieldLabel htmlFor="nickname">昵称</FieldLabel>
              <Input
                id="nickname"
                name="nickname"
                autoComplete="nickname"
                value={nickname}
                placeholder="请输入昵称"
                aria-invalid={state.nicknameError ? true : undefined}
                onChange={(e) => setNickname(e.target.value)}
              />
              <FieldError>{state.nicknameError}</FieldError>
              <FieldDescription>之后可以在「我的」里改。</FieldDescription>
            </Field>

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "创建中…" : "完成"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
