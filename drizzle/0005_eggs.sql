CREATE TYPE "public"."egg_source" AS ENUM('imported', 'custom');--> statement-breakpoint
CREATE TABLE "eggs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(96) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"author" varchar(128),
	"docker_images" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"startup" text DEFAULT '' NOT NULL,
	"stop_command" varchar(255),
	"install_script" text,
	"install_container" varchar(255) DEFAULT 'debian:bookworm-slim' NOT NULL,
	"install_entrypoint" varchar(64) DEFAULT 'bash' NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" "egg_source" DEFAULT 'custom' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "egg_id" uuid;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "startup" text;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "stop_command" varchar(255);--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "install_script" text;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "install_container" varchar(255);--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "install_entrypoint" varchar(64);--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "mount_path" varchar(255) DEFAULT '/data' NOT NULL;--> statement-breakpoint
ALTER TABLE "eggs" ADD CONSTRAINT "eggs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_egg_id_eggs_id_fk" FOREIGN KEY ("egg_id") REFERENCES "public"."eggs"("id") ON DELETE set null ON UPDATE no action;