CREATE TYPE "public"."account_origin" AS ENUM('k8s', 'minecraft', 'bot');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(32) NOT NULL,
	"email" varchar(255),
	"password_hash" text NOT NULL,
	"origin" "account_origin" DEFAULT 'k8s' NOT NULL,
	"avatar" "bytea",
	"discord_id" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
