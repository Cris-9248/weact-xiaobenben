"use client";

import { useState } from "react";
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
import { RELATIONS, RELATION_LABEL } from "@/lib/constants";
import { isValidPhone } from "@/lib/validation";
import type { RelationKind } from "@/lib/types";

export function AddFriendDialog() {
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState<RelationKind>("friend");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidPhone(phone)) {
      setError("请输入有效的 11 位手机号");
      return;
    }
    setError(null);
    // TODO: Server Action → 按手机号查找用户并建立 Friendship。
    // 注意：不能靠这里判断权限，服务端必须重新校验会话与目标用户是否存在。
    toast("添加好友尚未接入后端");
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <UserPlus data-icon="inline-start" />
        添加好友
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>添加好友</DialogTitle>
            <DialogDescription>
              输入对方的手机号，关系标注只有你自己能看到。
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="friend-phone">手机号</FieldLabel>
              <Input
                id="friend-phone"
                type="tel"
                inputMode="numeric"
                placeholder="138 0000 0000"
                value={phone}
                aria-invalid={error ? true : undefined}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (error) setError(null);
                }}
              />
              <FieldError>{error}</FieldError>
              <FieldDescription>
                对方必须已经注册 Weact小本本。
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="friend-relation">关系</FieldLabel>
              <Select
                value={relation}
                onValueChange={(v) => setRelation(v as RelationKind)}
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
            <Button type="submit">添加</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
