CREATE TABLE "app_settings" (
	"id" varchar(16) PRIMARY KEY DEFAULT 'global' NOT NULL,
	"theme" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
