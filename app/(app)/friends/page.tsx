import { PageHeader } from "@/components/page-header";
import { AddFriendDialog } from "@/components/friend/add-friend-dialog";
import { RelationPicker } from "@/components/friend/relation-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { myFriendships } from "@/lib/mock-data";

export const metadata = { title: "好友" };

export default function FriendsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="好友"
        description="关系标注只对你自己可见，随时可以改。"
        action={<AddFriendDialog />}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {myFriendships.map((friendship) => (
          <Card key={friendship.id}>
            <CardContent className="flex items-center gap-3 py-4">
              <Avatar className="size-10">
                <AvatarFallback>
                  {friendship.friend.nickname.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {friendship.friend.nickname}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {friendship.friend.phone}
                </p>
              </div>
              <RelationPicker
                friendName={friendship.friend.nickname}
                relation={friendship.relation}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
