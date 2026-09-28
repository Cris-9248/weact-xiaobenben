"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

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
import { cn } from "cn";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  checkPassword,
  type PasswordProblem,
} from "@/lib/validation";

const RULES = Object.keys(PASSWORD_RULES) as PasswordProblem[];

/**
 * Shown once, right after a phone number auto-registers. Login is
 * phone + OTP, so this password is a secondary credential, not the primary one.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const problems = checkPassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (problems.length > 0 || mismatch || password.length === 0) return;

    // TODO: Server Action → 写入密码哈希。明文永不离开这个表单。
    toast("密码设置成功");
    router.push("/activities");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>设置密码</CardTitle>
        <CardDescription>
          账号已创建，设置一个密码用于后续登录。
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={submitted && problems.length > 0 ? true : undefined}>
              <FieldLabel htmlFor="password">密码</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <ul className="mt-1 space-y-1">
                {RULES.map((rule) => {
                  const ok = !problems.includes(rule);
                  return (
                    <li
                      key={rule}
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        ok ? "text-muted-foreground" : "text-destructive"
                      )}
                    >
                      {ok ? (
                        <Check className="size-3.5" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                      {PASSWORD_RULES[rule]}
                    </li>
                  );
                })}
              </ul>
            </Field>

            <Field data-invalid={mismatch ? true : undefined}>
              <FieldLabel htmlFor="confirm">确认密码</FieldLabel>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                aria-invalid={mismatch ? true : undefined}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <FieldError>{mismatch ? "两次输入的密码不一致" : null}</FieldError>
            </Field>

            <Button type="submit" className="w-full">
              完成
            </Button>
            <p className="text-xs text-muted-foreground">
              密码至少 {PASSWORD_MIN_LENGTH} 位，需包含小写字母和数字。
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
