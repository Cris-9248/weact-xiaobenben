"use client";

import { useState } from "react";
import { Check, MapPin, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { cn } from "cn";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { ProposalWithVotes } from "@/lib/types";

/**
 * 一个候选计划 + 投票。Vote state is local for now — the Server Action that
 * persists it is not wired yet, so this only reflects the optimistic view.
 */
export function ProposalCard({
  proposal,
  totalVoters,
  isWinner,
}: {
  proposal: ProposalWithVotes;
  totalVoters: number;
  isWinner: boolean;
}) {
  const [voted, setVoted] = useState(proposal.votedByMe);
  const [count, setCount] = useState(proposal.votes.length);

  const pct = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;

  function toggleVote() {
    setVoted((v) => !v);
    setCount((c) => (voted ? c - 1 : c + 1));
    // TODO: Server Action → 写入/撤销投票。
    toast(voted ? "已取消投票" : "已投票", {
      description: "投票持久化待接入后端。",
    });
  }

  return (
    <Card
      className={cn(
        "gap-0 py-0",
        isWinner && "ring-2 ring-primary/40"
      )}
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-base font-semibold">
                {proposal.title}
              </h3>
              {isWinner ? (
                <Badge>
                  <Check data-icon="inline-start" />
                  已确定
                </Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {proposal.author.nickname} 提议
              {proposal.startsAt ? ` · ${formatDateTime(proposal.startsAt)}` : ""}
            </p>
          </div>
          <Button
            variant={voted ? "default" : "outline"}
            size="sm"
            onClick={toggleVote}
            aria-pressed={voted}
          >
            <ThumbsUp data-icon="inline-start" />
            {count}
          </Button>
        </div>

        {proposal.detail ? (
          <p className="text-sm text-muted-foreground">{proposal.detail}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {proposal.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {proposal.location.label}
            </span>
          ) : null}
          {proposal.estimatedPerPerson ? (
            <span>人均 {formatCurrency(proposal.estimatedPerPerson)}</span>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Progress value={pct}>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
          <p className="text-xs text-muted-foreground">
            {count}/{totalVoters} 人已投 · {pct}%
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
