CREATE TYPE "public"."image_source" AS ENUM('manual', 'egg');--> statement-breakpoint
CREATE TABLE "docker_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"label" varchar(128),
	"category" varchar(64),
	"source" "image_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "docker_images_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
-- Backfill : importe les images des eggs existants dans le catalogue.
-- La clé jsonb = libellé, la valeur = référence de l'image.
INSERT INTO "docker_images" ("reference", "label", "source")
SELECT DISTINCT ON (img.value) img.value, img.key, 'egg'
FROM "eggs", jsonb_each_text("eggs"."docker_images") AS img(key, value)
ON CONFLICT ("reference") DO NOTHING;
