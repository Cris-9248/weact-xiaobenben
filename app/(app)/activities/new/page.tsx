import { PageHeader, Placeholder } from "@/components/page-header";
import { ActivityForm } from "@/components/activity/activity-form";
import { requireSessionUser } from "@/lib/auth/session";
import { listFriends } from "@/lib/friends/dal";

export const metadata = { title: "新建活动" };

export default async function NewActivityPage() {
  // 成员选择器要的是**当前用户自己的**好友，而这件事只有服务端做得到：会话在
  // cookie 里，`listFriends` 又只能从服务端调。ActivityForm 是 Client Component，
  // 拿不到也读不了 —— 所以在这里查完再传下去。
  //
  // 页面自己读会话，不依赖布局，理由和 app/(app)/friends/page.tsx 一样。
  const user = await requireSessionUser();
  const friends = await listFriends(user.id);

  // 只传 `friend` 那一层：`FriendRow` 还带着 `since`、`relationNote` 这些选择器
  // 用不上的字段，而 `friendshipId` 更不该出现在这个组件里 —— 新建活动不需要
  // 任何「改这一行」的能力。
  return (
    <div className="space-y-6">
      <PageHeader
        title="新建活动"
        description="先定个初步计划，拉人进来投票，最后拍板。"
      />
      <ActivityForm friends={friends.map((row) => row.friend)} />
      <Placeholder>
        待接入：提交后创建活动并把成员拉进小团体；地点定位需要地图服务，
        这里先用纯文本地址。
      </Placeholder>
    </div>
  );
}
