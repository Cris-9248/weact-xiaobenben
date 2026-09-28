"use client";

import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ActivityTypePicker } from "@/components/activity/activity-type-picker";
import { DateTimePicker } from "@/components/date-time-picker";
import { cn } from "cn";
import { formatCurrency } from "@/lib/format";
import { myFriendships } from "@/lib/mock-data";
import { isValidPhone, normalizePhone } from "@/lib/validation";
import type { ActivityType } from "@/lib/types";

interface Draft {
  type: ActivityType;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  budgetTotal: string;
  budgetPerPerson: string;
  description: string;
  /** Ids of friends picked from the quick list. */
  memberIds: string[];
  /**
   * Normalized phone numbers of people who are not (yet) friends. Kept apart
   * from `memberIds` because they are a different thing downstream: one becomes
   * an `activity_members` row, the other an invite keyed by phone that resolves
   * to a user only once that phone is registered.
   */
  invites: string[];
}

const EMPTY: Draft = {
  type: "dining",
  title: "",
  startsAt: "",
  endsAt: "",
  location: "",
  budgetTotal: "",
  budgetPerPerson: "",
  description: "",
  memberIds: [],
  invites: [],
};

/**
 * 新建活动：主题 / 时间 / 地点定位 / 预计花费 / 预计人均 / 具体说明。
 * Field state is local for now; the Server Action call is stubbed.
 */
export function ActivityForm() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const total = Number(draft.budgetTotal);
  /** +1 for yourself. */
  const headcount = draft.memberIds.length + draft.invites.length + 1;
  const suggested =
    total > 0 && headcount > 0 ? Math.round(total / headcount) : null;

  /** Adding someone already covered by the quick list would double-count them. */
  function addInvite() {
    const phone = normalizePhone(invitePhone);
    if (!isValidPhone(phone)) {
      setInviteError("请输入有效的 11 位手机号");
      return;
    }
    if (myFriendships.some((f) => f.friend.phone === phone)) {
      setInviteError("这个人已经是好友了，直接在上面选就行");
      return;
    }
    if (draft.invites.includes(phone)) {
      setInviteError("已经添加过了");
      return;
    }
    setInviteError(null);
    setInvitePhone("");
    set("invites", [...draft.invites, phone]);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) {
      toast.error("请填写活动主题");
      return;
    }
    // TODO: Server Action → 创建活动 + 生成小团体 + 写入初步计划。
    toast("活动创建尚未接入后端", {
      description: "表单校验通过，提交逻辑待实现。",
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="py-6">
          <FieldGroup>
            <Field>
              <FieldLabel>活动类型</FieldLabel>
              <ActivityTypePicker
                value={draft.type}
                onChange={(next) => set("type", next)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="title">主题</FieldLabel>
              <Input
                id="title"
                value={draft.title}
                placeholder="例如：老王家火锅局"
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="startsAt">开始时间</FieldLabel>
                <DateTimePicker
                  id="startsAt"
                  value={draft.startsAt}
                  onChange={(next) => set("startsAt", next)}
                  placeholder="选择开始时间"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endsAt">结束时间</FieldLabel>
                <DateTimePicker
                  id="endsAt"
                  value={draft.endsAt}
                  onChange={(next) => set("endsAt", next)}
                  placeholder="选择结束时间"
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="location">地点定位</FieldLabel>
              <Input
                id="location"
                value={draft.location}
                placeholder="搜索或输入地址"
                onChange={(e) => set("location", e.target.value)}
              />
              <FieldDescription>
                地图选点待接入，暂时填文本地址。
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>拉谁进小团体</FieldLabel>

              {myFriendships.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {myFriendships.map(({ friend }) => {
                    const picked = draft.memberIds.includes(friend.id);
                    return (
                      <button
                        key={friend.id}
                        type="button"
                        aria-pressed={picked}
                        onClick={() =>
                          set(
                            "memberIds",
                            picked
                              ? draft.memberIds.filter((id) => id !== friend.id)
                              : [...draft.memberIds, friend.id]
                          )
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors",
                          picked
                            ? "border-primary bg-secondary"
                            : "hover:bg-muted"
                        )}
                      >
                        <Avatar className="size-6">
                          <AvatarFallback className="text-[0.6rem]">
                            {friend.nickname.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        {friend.nickname}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Invited non-friends. Dashed so they read as provisional — they
                  are pending invites, not people who have joined yet. */}
              {draft.invites.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {draft.invites.map((phone) => (
                    <span
                      key={phone}
                      className="flex items-center gap-2 rounded-full border border-dashed py-1 pr-2 pl-3 text-sm"
                    >
                      <span className="text-muted-foreground">待接受</span>
                      <span className="font-medium tabular-nums">{phone}</span>
                      <button
                        type="button"
                        aria-label={`移除 ${phone}`}
                        onClick={() =>
                          set(
                            "invites",
                            draft.invites.filter((p) => p !== phone)
                          )
                        }
                        className="grid size-4 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  id="invite-phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="输入手机号拉非好友"
                  value={invitePhone}
                  aria-invalid={inviteError ? true : undefined}
                  aria-label="手机号"
                  className="sm:max-w-60"
                  onChange={(e) => {
                    setInvitePhone(e.target.value);
                    if (inviteError) setInviteError(null);
                  }}
                  onKeyDown={(e) => {
                    // Enter inside a form submits it; this field adds a chip.
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInvite();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addInvite}
                  disabled={!invitePhone.trim()}
                >
                  <UserPlus data-icon="inline-start" />
                  添加
                </Button>
              </div>
              <FieldError>{inviteError}</FieldError>

              <FieldDescription>
                上面是好友，点一下就能选中；对方还不是好友时，输手机号也能拉进来。
                加上你自己，目前 {headcount} 人。
              </FieldDescription>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="budgetTotal">预计花费</FieldLabel>
                <Input
                  id="budgetTotal"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={draft.budgetTotal}
                  placeholder="0"
                  onChange={(e) => set("budgetTotal", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="budgetPerPerson">预计人均</FieldLabel>
                <Input
                  id="budgetPerPerson"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={draft.budgetPerPerson}
                  placeholder={suggested ? String(suggested) : "0"}
                  onChange={(e) => set("budgetPerPerson", e.target.value)}
                />
                <FieldDescription>
                  {suggested
                    ? `按 ${headcount} 人均摊约 ${formatCurrency(suggested)}`
                    : "填了总预算后可以自动估算"}
                </FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="description">具体说明</FieldLabel>
              <Textarea
                id="description"
                rows={4}
                value={draft.description}
                placeholder="行程安排、注意事项、要带的东西…"
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>

            <Button type="submit" className="w-full sm:w-auto">
              创建活动
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  );
}
