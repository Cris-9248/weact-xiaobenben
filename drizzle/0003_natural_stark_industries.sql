CREATE TABLE "friendships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"friend_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"relation_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_not_self" CHECK ("friendships"."owner_id" <> "friendships"."friend_id")
);
--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_friend_id_users_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_owner_friend_idx" ON "friendships" USING btree ("owner_id","friend_id");--> statement-breakpoint
CREATE INDEX "friendships_owner_idx" ON "friendships" USING btree ("owner_id");