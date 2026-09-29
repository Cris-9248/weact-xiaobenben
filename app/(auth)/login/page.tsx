"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { PASSWORD_RULES, checkPassword, isValidPhone } from "@/lib/validation";

/**
 * 手机号 + 密码，一个表单两条路径。没有验证码：短信通道对个人开发者基本
 * 走不通，而且这里无论新老用户收的都是同一个密码字段，再插一步 OTP 只会
 * 让流程更长。
 *
 * 密码放在这一页而不是注册页，是为了让它**只经过一个请求**：服务端拿到
 * 手机号就知道该校验还是该建号，明文密码全程不回传浏览器。
 */
export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const nextPhoneError = isValidPhone(phone)
      ? null
      : "请输入有效的 11 位手机号";
    const problems = checkPassword(password);
    const nextPasswordError =
      problems.length === 0
        ? null
        : `密码需满足：${problems.map((p) => PASSWORD_RULES[p]).join("、")}`;

    setPhoneError(nextPhoneError);
    setPasswordError(nextPasswordError);
    if (nextPhoneError || nextPasswordError) return;

    setSubmitting(true);

    // TODO: Server Action → 用手机号查一次库，在同一个请求里分两条路：
    //   已注册 → 校验密码。对了签发会话并 router.push("/activities")；
    //            错了把错误写回 passwordError，不透露是号码还是密码不对。
    //   新号   → 直接拿这个请求里的手机号 + 密码建账号（nickname 先留空），
    //            种一个「待完成注册」的短时 cookie 记住是哪个账号，
    //            再去 /register/password 补昵称。
    //
    // 校验规则在这里是照着「建号」那条路定的。后端落地后应该把
    // checkPassword 挪到服务端的新号分支里 —— 否则将来放宽规则时，
    // 按旧规则注册的老用户会在登录页被自己的密码挡住。
    toast("后端尚未接入", { description: "接入前这里会先跳到补昵称那一步。" });
    setSubmitting(false);
    router.push("/register/password");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>登录</CardTitle>
        <CardDescription>没注册过的手机号会自动创建账号。</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={phoneError ? true : undefined}>
              <FieldLabel htmlFor="phone">手机号</FieldLabel>
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                placeholder="请输入正确的手机号码"
                aria-invalid={phoneError ? true : undefined}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError(null);
                }}
              />
              <FieldError>{phoneError}</FieldError>
            </Field>

            <Field data-invalid={passwordError ? true : undefined}>
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
                aria-invalid={passwordError ? true : undefined}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(null);
                }}
              />
              <FieldError>{passwordError}</FieldError>
            </Field>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "登录中…" : "登录"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
