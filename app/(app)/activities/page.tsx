import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ActivityCard } from "@/components/activity/activity-card";
import { buttonVariants } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { activities } from "@/lib/mock-data";

export const metadata = { title: "活动" };

/** 历史活动列表 — 只显示关键字段，详情留给 `/activities/[id]`。 */
export default function ActivitiesPage() {
  const planning = activities.filter((a) => a.status !== "finished");
  const finished = activities.filter((a) => a.status === "finished");

  return (
    <div className="space-y-6">
      <PageHeader
        title="活动"
        // Neutral wording: the three built-in types are no longer the only
        // ones an activity can have.
        description="你参与过的每一场活动。"
        action={
          // A styled link, not `<Button render={<Link />}>`. Base UI's Button
          // enforces button semantics and logs
          // "A component that acts as a button expected a native <button>"
          // when the rendered tag is an `<a>` — links have their own semantics.
          <Link href="/activities/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            新建活动
          </Link>
        }
      />

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">待进行 {planning.length}</TabsTrigger>
          <TabsTrigger value="finished">已结束 {finished.length}</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="pt-4">
          <ActivityList items={planning} emptyHint="还没有安排，新建一个活动吧。" />
        </TabsContent>
        <TabsContent value="finished" className="pt-4">
          <ActivityList items={finished} emptyHint="还没有结束的活动。" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActivityList({
  items,
  emptyHint,
}: {
  items: typeof activities;
  emptyHint: string;
}) {
  if (items.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>暂无活动</EmptyTitle>
          <EmptyDescription>{emptyHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
