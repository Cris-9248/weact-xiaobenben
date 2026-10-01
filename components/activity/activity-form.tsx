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
import { isValidPhone, normalizePhone } from "@/lib/validation";
import type { ActivityType, FriendSummary } from "@/lib/types";

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
 *
 * **好友列表由父级传进来。** 这是个 Client Component，读不了会话也读不了库 ——
 * 而这里要的是「我自己的好友」，不是一张全站名单。父级
 * (app/activities/new/page.tsx) 读会话、按 ownerId 查完再传下来，这个组件只负责
 * 画出来。所以它收的是已经过滤好的数据，自己没有任何取数能力。
 */
export function ActivityForm({ friends }: { friends: FriendSummary[] }) {
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
    if (friends.some((f) => f.phone === phone)) {
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

              {friends.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {friends.map((friend) => {
                    const picked = draft.memberIds.includes(friend.id);
                    // 昵称可空：手机号注册是先建行、后取名。措辞与好友页、
                    // 管理页统一。真让这样的账号进活动是不合适的，但那是提交
                    // 那一步的事 —— 这里先把人显示出来，而不是渲染成一片空白。
                    const name = friend.nickname ?? "未完成注册";
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
                        // `min-h-11`：整颗 chip 就是可点区域，`py-1` 加头像只有 32px。
                        className={cn(
                          "flex min-h-11 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors",
                          picked
                            ? "border-primary bg-secondary"
                            : "hover:bg-muted"
                        )}
                      >
                        <Avatar className="size-6">
                          <AvatarFallback className="text-[0.6rem]">
                            {name.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        {name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                // 一个好友都没有时不能什么都不显示：那样新用户看到的只是一个
                // 缺了一块的表单，没有任何东西解释那一块本来该有什么。
                <FieldDescription>
                  你还没有好友，所以这里没有可选的人。先去「好友」页加几个，
                  或者直接在下面输手机号。
                </FieldDescription>
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
                        // 视觉尺寸从 16px 提到 24px —— 那个 16px 的点是全应用最小的
                        // 可点目标 —— 再用 `after:-inset-y-2.5` 把**高度**撑到 44px。
                        // 横向**不扩**：相邻 chip 之间只有 8px，横向扩出去命中区会
                        // 互相重叠，点在左边那颗的右半边会删掉右边那颗。
                        className="relative grid size-6 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors after:absolute after:-inset-y-2.5 hover:bg-muted hover:text-foreground"
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
                  // 这个框里的 Enter 被下面 onKeyDown 拦下来加 chip 了，不让它提交
                  // 表单 —— 但软键盘上那个键的文案还按「会提交」来显示，也就是
                  // 「前往」。`enterKeyHint` 的合法值里没有「添加」，就选 `enter`：
                  // 它是唯一一个不承诺任何别的事情的选项（`go`/`send` 都说会提交，
                  // `done` 说会结束，`next` 说会跳下一栏，三个都不对）。
                  enterKeyHint="enter"
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
                {/* `type="text"` 而不是 `type="number"`：number 会带出原生的上下
                    箭头（手机上看着像个坏掉的控件），而且部分安卓输入法会无视
                    `inputMode="decimal"`、弹出带 `-` 和 `e` 的全键盘。
                    代价是字母也能打进来了 —— 由下面那句 `total > 0` 兜住：
                    `Number("abc")` 是 NaN，而 `NaN > 0` 为假，估算只是不出现，
                    不会渲染出 `¥NaN`。真正算账的地方在服务端，它本来就要自己解析。 */}
                <Input
                  id="budgetTotal"
                  type="text"
                  inputMode="decimal"
                  value={draft.budgetTotal}
                  placeholder="0"
                  onChange={(e) => set("budgetTotal", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="budgetPerPerson">预计人均</FieldLabel>
                {/* 同上：`type="text"` + `inputMode="decimal"`。 */}
                <Input
                  id="budgetPerPerson"
                  type="text"
                  inputMode="decimal"
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
