CREATE TYPE "public"."price_interval" AS ENUM('hour', 'month', 'year');--> statement-breakpoint
CREATE TABLE "node_meta" (
	"node_name" varchar(255) PRIMARY KEY NOT NULL,
	"hosting_url" text,
	"hosting_label" varchar(128),
	"price_cents" integer,
	"price_currency" varchar(8) DEFAULT 'EUR' NOT NULL,
	"price_interval" "price_interval",
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
