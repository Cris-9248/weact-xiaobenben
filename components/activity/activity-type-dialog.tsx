"use client";

import { useState } from "react";

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
import { useActivityTypes } from "@/hooks/use-activity-types";
import {
  addActivityType,
  isLabelTaken,
  updateActivityType,
} from "@/lib/activity-types";
import { cn } from "cn";
import type { CustomActivityType } from "@/lib/types";

/**
 * Create or rename a custom activity type.
 *
 * Doubles as the settings-page editor and the activity form's inline creator,
 * so the two entry points cannot drift apart in validation or copy.
 */
export function ActivityTypeDialog({
  trigger,
  existing,
  onSaved,
}: {
  /** The element that opens the dialog. */
  trigger: React.ReactElement;
  /** Present → edit mode. Absent → create mode. */
  existing?: CustomActivityType;
  /** Called with the record after a successful create, so the activity form
   *  can select the type it just made. */
  onSaved?: (saved: CustomActivityType) => void;
}) {
  const [open, setOpen] = useState(false);
  const customTypes = useActivityTypes();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        {/* Keyed so switching between rows (or create → edit) remounts the
            form: the fields below seed from `existing`, and a stale draft from
            the previous target would otherwise carry over. Base UI unmounts
            closed popups anyway; this makes it independent of that. */}
        <TypeForm
          key={existing?.id ?? "new"}
          existing={existing}
          customTypes={customTypes}
          onDone={(saved) => {
            onSaved?.(saved);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TypeForm({
  existing,
  customTypes,
  onDone,
  onCancel,
}: {
  existing?: CustomActivityType;
  customTypes: CustomActivityType[];
  onDone: (saved: CustomActivityType) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(existing?.label ?? "");
  const [needsTravel, setNeedsTravel] = useState(existing?.needsTravel ?? false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = label.trim();

    if (!trimmed) {
      setError("请输入类型名称");
      return;
    }
    // Checked client-side only for feedback. The real rule is enforced by the
    // store once there is a server to enforce it on; a duplicate label is a
    // display problem, not a security one.
    if (isLabelTaken(trimmed, customTypes, existing?.id)) {
      setError("已经有同名的类型了");
      return;
    }

    if (existing) {
      updateActivityType(existing.id, { label: trimmed, needsTravel });
      onDone({ ...existing, label: trimmed, needsTravel });
    } else {
      onDone(addActivityType(trimmed, needsTravel));
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{existing ? "编辑活动类型" : "新建活动类型"}</DialogTitle>
        <DialogDescription>
          颜色会自动分配，之后可以随时改名或删除。类型保存在本机。
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="py-4">
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="type-label">类型名称</FieldLabel>
          <Input
            id="type-label"
            value={label}
            maxLength={12}
            placeholder="例如：剧本杀"
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setLabel(e.target.value);
              if (error) setError(null);
            }}
          />
          <FieldError>{error}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="type-needs-travel">需要交通住宿</FieldLabel>
          {/* A plain toggle button rather than a checkbox: there is no
              `checkbox.tsx` or `switch.tsx` in components/ui, and this matches
              the chip idiom already used for the member picker. */}
          <Button
            id="type-needs-travel"
            type="button"
            variant="outline"
            aria-pressed={needsTravel}
            onClick={() => setNeedsTravel((v) => !v)}
            className={cn(
              "w-fit",
              needsTravel && "border-primary bg-secondary"
            )}
          >
            {needsTravel ? "会显示「交通 · 住宿」" : "不显示交通住宿"}
          </Button>
          <FieldDescription>
            勾选后，这类活动的详情页会多出「交通 · 住宿」分区。
          </FieldDescription>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit">{existing ? "保存" : "创建"}</Button>
      </DialogFooter>
    </form>
  );
}
