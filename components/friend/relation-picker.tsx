"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RELATIONS, RELATION_LABEL } from "@/lib/constants";
import type { RelationKind } from "@/lib/types";

/**
 * 关系标注只对自己可见，所以改这里不会影响对方看到的关系。
 * Persistence is stubbed; state is local so the control still feels live.
 */
export function RelationPicker({
  friendName,
  relation: initial,
}: {
  friendName: string;
  relation: RelationKind;
}) {
  const [relation, setRelation] = useState<RelationKind>(initial);

  function change(next: string) {
    setRelation(next as RelationKind);
    // TODO: Server Action → 更新 Friendship.relation（需校验 ownerId === session.user.id）。
    toast(`已把${friendName}标为${RELATION_LABEL[next as RelationKind]}`, {
      description: "保存待接入后端。",
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            {RELATION_LABEL[relation]}
            <ChevronDown data-icon="inline-end" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={relation} onValueChange={change}>
          {RELATIONS.map((kind) => (
            <DropdownMenuRadioItem key={kind} value={kind}>
              {RELATION_LABEL[kind]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
