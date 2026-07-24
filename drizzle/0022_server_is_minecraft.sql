ALTER TABLE "servers" ADD COLUMN "is_minecraft" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "servers" SET "is_minecraft" = true
WHERE "egg_id" IN (SELECT "id" FROM "eggs" WHERE lower("category") LIKE '%minecraft%');