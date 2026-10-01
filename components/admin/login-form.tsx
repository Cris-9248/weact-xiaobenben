"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { adminSignIn } from "@/lib/admin/actions";
import { ADMIN_FORM_INITIAL } from "@/lib/admin/form-state";

/**
 * 管理员登录表单。
 *
 * 和用户侧登录页同一套写法，两个细节是有原因的：
 *
 *   - **受控，不是 defaultValue。** React 19 在 form action 结束后会重置非受控
 *     字段。服务端返回「用户名或密码不对」的同时，刚敲的两栏会被一起清空。
 *   - **这一页不做任何校验。** 用户名存不存在、口令对不对，判断依据只有服务端
 *     才知道，客户端先跑一遍只会让「同一条错误有两个来源」。
 */
export function AdminLoginForm() {
  const [state, formAction, isPending] = useActionState(
    adminSignIn,
    ADMIN_FORM_INITIAL,
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field data-invalid={state.usernameError ? true : undefined}>
          <FieldLabel htmlFor="username">用户名</FieldLabel>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            aria-invalid={state.usernameError ? true : undefined}
            onChange={(e) => setUsername(e.target.value)}
          />
          <FieldError>{state.usernameError}</FieldError>
        </Field>

        <Field data-invalid={state.passwordError ? true : undefined}>
          <FieldLabel htmlFor="password">密码</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={state.passwordError ? true : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FieldError>{state.passwordError}</FieldError>
        </Field>

        {/*
          「凭据不对」和「本部署没配置管理员口令」共用这一条。分开写就等于
          告诉调用方这个站还没设管理员密码 —— 一条不该存在的探测通道。
        */}
        <FieldError>{state.formError}</FieldError>

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "登录中…" : "登录"}
        </Button>
      </FieldGroup>
    </form>
  );
}
