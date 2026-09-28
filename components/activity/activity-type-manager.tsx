"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { ActivityTypeDialog } from "@/components/activity/activity-type-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useActivityTypes } from "@/hooks/use-activity-types";
import { deleteActivityType, resolveActivityType } from "@/lib/activity-types";
import { BUILT_IN_ACTIVITY_TYPES } from "@/lib/constants";
import { cn } from "cn";
import type { CustomActivityType } from "@/lib/types";

/**
 * Settings-page management for custom activity types.
 *
 * The three built-ins are listed read-only — no rename, no delete, no colour
 * control — because that is a product decision, and showing them greyed out
 * explains *why* the list already contains things the user did not create.
 * That is more honest than hiding them and leaving the form's picker as the
 * only place they appear.
 */
export function ActivityTypeManager() {
  const customTypes = useActivityTypes();
  const [pendingDelete, setPendingDelete] =
    useState<CustomActivityType | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>活动类型</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {BUILT_IN_ACTIVITY_TYPES.map((type) => {
            const meta = resolveActivityType(type, customTypes);
            return (
              <Row key={type} meta={meta}>
                <span className="shrink-0 text-xs text-muted-foreground">
                  内置
                </span>
              </Row>
            );
          })}
        </div>

        {customTypes.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              {customTypes.map((type) => (
                <Row key={type.id} meta={resolveActivityType(type.id, customTypes)}>
                  <div className="flex shrink-0 gap-1">
                    <ActivityTypeDialog
                      existing={type}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`编辑 ${type.label}`}
                        >
                          <Pencil />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`删除 ${type.label}`}
                      onClick={() => setPendingDelete(type)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </Row>
              ))}
            </div>
          </>
        )}

        <ActivityTypeDialog
          trigger={
            <Button variant="outline" size="sm">
              <Plus data-icon="inline-start" />
              新建类型
            </Button>
          }
        />

        <p className="text-xs text-muted-foreground">
          自定义类型保存在本机浏览器，换设备就没了。内置的三种不能改名或删除。
        </p>
      </CardContent>

      <DeleteDialog
        target={pendingDelete}
        onClose={() => setPendingDelete(null)}
      />
    </Card>
  );
}

function Row({
  meta,
  children,
}: {
  meta: { label: string; accent: string; needsTravel: boolean };
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge
          variant="secondary"
          className={cn("border-transparent", meta.accent)}
        >
          {meta.label}
        </Badge>
        {meta.needsTravel && (
          <span className="text-xs text-muted-foreground">含交通住宿</span>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * There is no `alert-dialog.tsx` in components/ui, so this reuses `Dialog` with
 * a destructive action. Confirmation rather than an undo because the store has
 * no history — deleting is genuinely final.
 */
function DeleteDialog({
  target,
  onClose,
}: {
  target: CustomActivityType | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>删除「{target?.label}」？</DialogTitle>
          <DialogDescription>
            删除后没法恢复。已经用了这个类型的活动不会被删掉，但它们的类型会显示成
            「未知类型」，也会失去「交通 · 住宿」分区。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (target) deleteActivityType(target.id);
              onClose();
            }}
          >
            删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
