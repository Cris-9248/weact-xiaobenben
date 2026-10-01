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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth/actions";
import { AUTH_FORM_INITIAL } from "@/lib/auth/form-state";

/**
 * 手机号 + 密码，一个表单两条路径。没有验证码 —— 短信通道对个人开发者基本
 * 走不通，而且这里无论新老用户收的都是同一个密码字段，再插一步 OTP 只会让
 * 流程更长。
 *
 * 这一页**不做任何校验**，全部交给 signIn。原先这里是客户端先跑一遍
 * `isValidPhone` / `checkPassword`，现在删掉了，而且不是因为"重复"才删的：
 * 密码强度规则只对**新建账号**成立，对一个老账号跑它，等于在规则收紧那天把
 * 老用户关在自己账号外面 —— 而他们密码是对的。判断依据只有服务端才知道
 * （这个号码在不在库里），所以判断也只能在服务端做。
 *
 * 代价是每次输错都要一次往返。可以接受：那两条错误在查库之前就返回了。
 */
export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    signIn,
    AUTH_FORM_INITIAL,
  );

  // 受控，不是 defaultValue。React 19 在 form action 结束后会**重置非受控
  // 字段** —— 服务端返回「密码不对」的同时，用户刚敲的两栏会被一起清空，
  // 等于逼他重打一遍。受控字段的值来自 React state，不受这次重置影响。
  //
  // 顺带解决自动填充：浏览器填密码管理器时会直接改 DOM 值，React 的 state
  // 未必跟得上。但提交走的是 FormData，读的是 DOM 里的真实值 —— 所以哪怕
  // state 落后了，发出去的仍然是用户看到的那个密码。
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>登录</CardTitle>
        <CardDescription>没注册过的手机号会自动创建账号。</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <Field data-invalid={state.phoneError ? true : undefined}>
              <FieldLabel htmlFor="phone">手机号</FieldLabel>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="请输入正确的手机号码"
                value={phone}
                aria-invalid={state.phoneError ? true : undefined}
                onChange={(e) => setPhone(e.target.value)}
              />
              <FieldError>{state.phoneError}</FieldError>
            </Field>

            <Field data-invalid={state.passwordError ? true : undefined}>
              <FieldLabel htmlFor="password">密码</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                // 新号也走这个字段，但浏览器该按「已有密码」提示 ——
                // 已注册用户才是这条路径上的多数。
                autoComplete="current-password"
                placeholder="密码至少8位, 包含字母和数字"
                value={password}
                aria-invalid={state.passwordError ? true : undefined}
                onChange={(e) => setPassword(e.target.value)}
              />
              <FieldError>{state.passwordError}</FieldError>
            </Field>

            {/*
              表单级错误，不属于任何一个字段。「手机号或密码不对」只能落在这里 ——
              挂到密码下面就等于告诉调用方"号码是对的，只是密码错了"，那正是
              手机号枚举想拿到的信息。FieldError 自带 role="alert"，无内容时
              返回 null，所以没有错误时它不占位置。
            */}
            <FieldError>{state.formError}</FieldError>

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "登录中…" : "登录"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
