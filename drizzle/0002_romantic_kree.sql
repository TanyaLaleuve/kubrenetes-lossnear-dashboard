CREATE TYPE "public"."server_state" AS ENUM('running', 'stopped');--> statement-breakpoint
CREATE TABLE "servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(48) NOT NULL,
	"slug" varchar(40) NOT NULL,
	"image" text NOT NULL,
	"command" text,
	"env" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"host_port" integer NOT NULL,
	"container_port" integer DEFAULT 25565 NOT NULL,
	"cpu_milli" integer NOT NULL,
	"memory_mi" integer NOT NULL,
	"disk_gi" integer NOT NULL,
	"desired_state" "server_state" DEFAULT 'stopped' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servers_slug_unique" UNIQUE("slug"),
	CONSTRAINT "servers_host_port_unique" UNIQUE("host_port")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "can_create_servers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "quota_max_servers" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "quota_memory_mi" integer DEFAULT 4096 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "quota_cpu_milli" integer DEFAULT 2000 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "quota_disk_gi" integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "servers_owner_name_lower_idx" ON "servers" USING btree ("owner_id",lower("name"));