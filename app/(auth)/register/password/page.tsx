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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NICKNAME_RULES, checkNickname } from "@/lib/validation";

/**
 * 注册第二步：补昵称。账号和密码在上一步的登录页就已经处理掉了。
 *
 * 路径仍叫 `register/password`，但这一页已经不收密码了 —— 名字是历史遗留，
 * 保留只是为了这次不动文件结构。真要改名，改的是目录名，引用点只有
 * 登录页里的那一次 `router.push`。
 */
export default function CompleteRegistrationPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    // 规则来自 lib/validation.ts，和登录页共用同一套 —— 服务端落地后
    // 也要跑同一个 checkNickname，否则放宽规则时两边会不一致。
    const problems = checkNickname(nickname);
    if (problems.length > 0) {
      setError(problems.map((p) => NICKNAME_RULES[p]).join("、"));
      return;
    }

    setError(null);
    setSubmitting(true);

    // TODO: Server Action → 靠「待完成注册」cookie 找回刚建的那个账号，
    // 写入昵称（trim 后再存，别把首尾空格带进库），清掉 cookie，然后签发会话。
    // 昵称的唯一性这里不校验：同名是允许的，登录身份是手机号。
    toast("后端尚未接入", { description: "接入前昵称不会真的保存。" });
    setSubmitting(false);
    router.push("/activities");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>取个昵称</CardTitle>
        <CardDescription>账号已创建，朋友们会看到这个名字。</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="nickname">昵称</FieldLabel>
              <Input
                id="nickname"
                name="nickname"
                autoComplete="nickname"
                value={nickname}
                aria-invalid={error ? true : undefined}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (error) setError(null);
                }}
              />
              <FieldError>{error}</FieldError>
              <FieldDescription>之后可以在「我的」里改。</FieldDescription>
            </Field>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "创建中…" : "完成"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
