DROP INDEX "friendships_owner_idx";--> statement-breakpoint
CREATE INDEX "friendships_friend_id_idx" ON "friendships" USING btree ("friend_id");