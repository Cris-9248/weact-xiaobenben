import { notFound } from "next/navigation";

import { ProposalCard } from "@/components/activity/proposal-card";
import { Placeholder } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { activities, proposals } from "@/lib/mock-data";

export const metadata = { title: "计划 · 投票" };

export default async function ActivityPlanPage(
  props: PageProps<"/activities/[id]/plan">
) {
  const { id } = await props.params;
  const activity = activities.find((a) => a.id === id);
  if (!activity) notFound();

  const list = proposals.filter((p) => p.activityId === id);
  const totalVoters = activity.members.length;
  const leader = list.reduce<typeof list[number] | null>(
    (best, p) => (best === null || p.votes.length > best.votes.length ? p : best),
    null
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          大家各提一版，投票最多的成为最终计划。
        </p>
        <Button variant="outline" size="sm">
          提一个方案
        </Button>
      </div>

      {list.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          totalVoters={totalVoters}
          isWinner={
            activity.status !== "planning" &&
            leader !== null &&
            proposal.id === leader.id
          }
        />
      ))}

      <Placeholder>
        待接入：新增方案、投票持久化、截止后锁定最终计划（写入 PlanDecision）。
      </Placeholder>
    </div>
  );
}
