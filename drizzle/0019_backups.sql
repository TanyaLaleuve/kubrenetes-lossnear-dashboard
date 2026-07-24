CREATE TYPE "public"."backup_kind" AS ENUM('manual', 'pre_delete');--> statement-breakpoint
CREATE TABLE "backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" uuid,
	"server_slug" varchar(40) NOT NULL,
	"server_name" varchar(48) NOT NULL,
	"owner_id" uuid,
	"kind" "backup_kind" DEFAULT 'manual' NOT NULL,
	"size_bytes" bigint DEFAULT 0 NOT NULL,
	"note" varchar(255),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "backup_limit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_backup" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "backup_quota" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "backups" ADD CONSTRAINT "backups_server_id_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."servers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backups" ADD CONSTRAINT "backups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backups" ADD CONSTRAINT "backups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;