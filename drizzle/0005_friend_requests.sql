ALTER TABLE "friendships" ADD COLUMN "status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "friendships" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "friendships" ADD COLUMN "seen_at" timestamp with time zone;--> statement-breakpoint
-- 下面这一句是**手工插入**的，不是 drizzle-kit 生成的。改 schema 之后重新 generate
-- 不会覆盖它（snapshot 只记 schema、不记数据），但也别把这个文件删掉重生成，否则
-- 这四行会丢，而迁移一旦应用过就不会再跑第二次。
--
-- 为什么需要它：表里已有的行是先于「加好友需要对方同意」这个流程存在的 —— 它们
-- 是一次单方面添加就直接建好的关系，双方早就是好友。新列的默认值 'pending' 会把
-- 它们读成两封待处理的好友请求：Cris 下次打开好友页会看到「venom 想加你为好友」，
-- 而他们从 9 月 30 日起就是好友；反过来 venom 也一样。所以这里一次性把它们认成
-- 已通过。
--
-- accepted_at 用 created_at 而不是 now()：那个时刻就是这段关系真正开始的时候，
-- 用 now() 会让两个老用户看到「你和 X 于今天成为好友」。
--
-- seen_at 一起回填：这些关系不是「刚加的」，既不该在通知区里冒出来，也不该给任何
-- 一张好友卡打上 new。真正的「新好友」是 seen_at 为 null 的那些。
--
-- 全新库上这条影响 0 行，本地开发库上影响 2 行。
UPDATE "friendships"
   SET "status" = 'accepted',
       "accepted_at" = "created_at",
       "seen_at" = "created_at";--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_status_valid" CHECK ("friendships"."status" in ('pending', 'accepted'));