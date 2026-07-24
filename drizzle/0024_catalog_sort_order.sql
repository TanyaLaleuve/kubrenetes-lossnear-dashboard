ALTER TABLE "eggs" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "docker_images" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;