import { PageHeader } from "@/components/page-header";
import { AddFriendDialog } from "@/components/friend/add-friend-dialog";
import { DeleteFriendButton } from "@/components/friend/delete-friend-button";
import { RelationPicker } from "@/components/friend/relation-picker";
import {
  FriendRequestActions,
  WithdrawRequestButton,
} from "@/components/friend/friend-request-actions";
import { MarkNotificationsSeen } from "@/components/friend/mark-notifications-seen";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireSessionUser } from "@/lib/auth/session";
import {
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
} from "@/lib/friends/dal";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "好友" };

/** 区块标题。页面级的居中大标题由 PageHeader 负责，这里是页内的分节。 */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-base font-semibold tracking-tight">
      {children}
    </h2>
  );
}

/** 可空的昵称（手机号注册先建行、后取名）在这几处都要兜底成同一句话。 */
function displayName(nickname: string | null): string {
  return nickname ?? "未完成注册";
}

export default async function FriendsPage() {
  // 页面自己读会话，不依赖布局 —— 布局拦不住同层页面的渲染。这一次调用和布局
  // 那次共用同一个请求级缓存，不额外查库。
  const user = await requireSessionUser();

  // 三个查询互不依赖，一起发。`listFriends` 按 ownerId 过滤，所以拿到的一定是
  // **这个人自己的**好友边；另外两个同理，各自按一侧过滤。
  const [friends, incoming, outgoing] = await Promise.all([
    listFriends(user.id),
    listIncomingRequests(user.id),
    listOutgoingRequests(user.id),
  ]);

  // 未读的「已同意」边。它同时驱动两处：下面那条「你和 X 已成为好友」的消息，
  // 以及好友卡右上角的 `new`。同一个事实的两种画法。
  const newFriends = friends.filter((friendship) => friendship.isNew);

  return (
    <div className="space-y-6">
      <PageHeader
        title="好友"
        description="加好友需要对方同意。关系标注只对你自己可见，随时可以改。"
        action={<AddFriendDialog />}
      />

      {/*
        标记已读。**只有真的有未读时才挂载** —— 没消息的访问一次 action 都不发。
        key 是未读集合的签名：这一页上确实可能冒出新的未读边（互发请求、或别人在
        这期间同意了我），而组件一旦挂载就不会重挂，没有这个 key 就没人去标记它了。
        同意**别人**的请求不在其列 —— 那种情况下我自己那一行出生即已读。
        它不渲染任何东西，也不触发重渲染（action 里没有 revalidatePath，理由写在
        components/friend/mark-notifications-seen.tsx）。
      */}
      {newFriends.length > 0 && (
        <MarkNotificationsSeen
          key={newFriends.map((f) => f.friendshipId).join("|")}
        />
      )}

      {/* 1. 待我处理的请求。放在最上面：它需要用户做一个决定。 */}
      {incoming.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>好友请求</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {incoming.map((request) => {
              const name = displayName(request.other.nickname);

              return (
                <Card key={request.other.id}>
                  <CardContent className="flex items-center gap-3 py-4">
                    <Avatar className="size-10">
                      <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      {/*
                        这里**没有**关系标注，而且不是漏了：请求行上那个 relation
                        是发起方给接收方标的，界面上的承诺是「关系标注只有你自己
                        能看到」。dal 的投影里就没有这个字段，所以想漏也漏不出来。
                      */}
                      <p className="truncate text-xs text-muted-foreground">
                        {request.other.phone} · {formatDateTime(request.requestedAt.toISOString())}
                      </p>
                    </div>
                    <FriendRequestActions
                      requesterId={request.other.id}
                      requesterName={name}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. 好友关系成立的消息。纯通知，没有按钮 —— 它靠被看过而消失。 */}
      {newFriends.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>新好友</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {newFriends.map((friendship) => {
              const name = displayName(friendship.friend.nickname);

              return (
                <Card key={friendship.friendshipId}>
                  <CardContent className="py-4 text-sm">
                    {/*
                      **文案必须对称**，这是这一行唯一难的地方。这张卡片渲染给
                      「没有亲手促成这件事」的那一方：请求方（对方同意了），以及互发
                      请求时那个以为自己只是发出去一个请求的人。他们看到的是同一段
                      关系、同一个 `acceptedAt`，而各自发生的事是相反的。写「X 同意了
                      你的好友请求」在请求方那边是对的，在互发那位那边就是假的 ——
                      他没有同意过任何东西。所以这里只说**关系成立**这件双方都成立的
                      事，不说谁点的头。

                      **点了「同意」的那个人看不到这张卡片**（2026-10-01 起）。他刚
                      做完决定，这条消息对他没有信息量，而它带来的那条未读还会把侧栏
                      角标顶住不动 —— 见 lib/friends/dal.ts 里 `sealFriendship` 的
                      `selfSeen`。需求里「添加成功后双方都收到通知」仍然成立：同意方
                      收到的是那句 toast。
                    */}
                    <span className="text-muted-foreground">你和 </span>
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground"> 已成为好友</span>
                    {friendship.since ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(friendship.since.toISOString())}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. 我发出去、还在等的请求。这里是「撤回」唯一的落点。 */}
      {outgoing.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>等待对方同意</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {outgoing.map((request) => {
              const name = displayName(request.other.nickname);

              return (
                <Card key={request.other.id}>
                  <CardContent className="flex items-center gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDateTime(request.requestedAt.toISOString())} 发出的请求
                      </p>
                    </div>
                    <WithdrawRequestButton
                      friendId={request.other.id}
                      friendName={name}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. 名册。放最后：它是这一页的常驻内容，上面那些临时区块出现时不该把它
          推来推去。空态**只在这段里** —— 一个好友都没有的新用户，恰恰是最可能
          收到第一条好友请求的人，不能因为名册是空的就把上面三段一起藏掉。 */}
      {friends.length === 0 ? (
        // `border` 和 `border-dashed` 都要写：Empty 的基类只有 `border-dashed`，
        // 没有边框宽度，只写虚线等于什么都不显示。
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>还没有好友</EmptyTitle>
            <EmptyDescription>
              输入对方的手机号发送请求。对方需要已经注册，同意之后才会出现在这里。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {friends.map((friendship) => {
            // 昵称可空：手机号注册是先建行、后取名。addFriend 不会给还没取名的
            // 账号发请求，所以这一行在实践中不该出现；兜底是为了手工插入或
            // 将来数据导入造成的行不会渲染成空白。
            const name = displayName(friendship.friend.nickname);

            return (
              // `relative` 是 `new` 标记定位的基准，不能删 —— Card 自己不设
              // position，删掉的话标记会相对页面定位跑到角落里。
              <Card key={friendship.friendshipId} className="relative">
                {friendship.isNew && (
                  // 内缩而不是 `-top-1 -right-1`：Card 带 `overflow-hidden`，
                  // 压到圆角外面会被裁掉。这个位置落在卡片自己的 py-4 内边距里。
                  <span
                    data-slot="new-friend-badge"
                    className="absolute top-2 right-2 rounded-full bg-primary px-1.5 py-0.5 font-heading text-[0.6rem] leading-none font-semibold tracking-wide text-primary-foreground"
                  >
                    new
                  </span>
                )}
                {/* 两行，不是一行。单行放不下：320px 下卡片只有 288px 宽，
                    去掉头像和两个控件之后名字块只剩七十来个像素，而下面那行
                    11 位手机号在 text-xs 下就要七十多 —— 手机号被截断是实打实的
                    信息损失。分行之后第二行整行都是控件，也顺带把「删除」和
                    「改标注」分到了不同区域，少一点误触。

                    代价是卡片从 104px 变成约 144px。接受：sm:grid-cols-2 本来就
                    是一片卡墙，两行换来的是一整行不受挤压的宽度。 */}
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {friendship.friend.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <RelationPicker
                      friendshipId={friendship.friendshipId}
                      friendName={name}
                      relation={friendship.relation}
                    />
                    <DeleteFriendButton
                      friendId={friendship.friend.id}
                      friendName={name}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
