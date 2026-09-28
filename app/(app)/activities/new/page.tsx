import { PageHeader, Placeholder } from "@/components/page-header";
import { ActivityForm } from "@/components/activity/activity-form";

export const metadata = { title: "新建活动" };

export default function NewActivityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="新建活动"
        description="先定个初步计划，拉人进来投票，最后拍板。"
      />
      <ActivityForm />
      <Placeholder>
        待接入：提交后创建活动并把成员拉进小团体；地点定位需要地图服务，
        这里先用纯文本地址。
      </Placeholder>
    </div>
  );
}
