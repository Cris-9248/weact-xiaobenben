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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { isValidPhone, isValidSmsCode, normalizePhone } from "@/lib/validation";

type Step = "phone" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function handleSendCode(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidPhone(phone)) {
      setPhoneError("请输入有效的 11 位手机号");
      return;
    }
    setPhoneError(null);
    setSending(true);

    // TODO: Server Action → 短信服务. A brand-new number auto-registers, and
    // the response decides whether we go to the OTP step or straight to
    // setting a password.
    toast("短信服务尚未接入", { description: "接入后这里会下发验证码。" });
    setSending(false);
    setStep("code");
  }

  function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidSmsCode(code)) {
      toast.error("验证码格式不正确");
      return;
    }
    // TODO: Server Action → 校验验证码。新用户跳转设置密码，老用户进活动列表。
    router.push("/register/password");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{step === "phone" ? "手机号登录" : "输入验证码"}</CardTitle>
        <CardDescription>
          {step === "phone"
            ? "未注册的手机号将自动创建账号。"
            : `验证码已发送至 ${normalizePhone(phone)}`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {step === "phone" ? (
          <form onSubmit={handleSendCode}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="phone">手机号</FieldLabel>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={phone}
                  aria-invalid={phoneError ? true : undefined}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    if (phoneError) setPhoneError(null);
                  }}
                />
                <FieldError>{phoneError}</FieldError>
              </Field>
              <Button type="submit" disabled={sending} className="w-full">
                {sending ? "发送中…" : "获取验证码"}
              </Button>
            </FieldGroup>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="code">验证码</FieldLabel>
                <InputOTP
                  id="code"
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  containerClassName="justify-start"
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }, (_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <FieldDescription>
                  没有收到？60 秒后可重新发送。
                </FieldDescription>
              </Field>
              <Button type="submit" className="w-full">
                下一步
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep("phone")}
              >
                换个手机号
              </Button>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
