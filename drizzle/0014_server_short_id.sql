-- Identifiant court public. Ajout en 3 temps pour ne pas casser les serveurs
-- existants : colonne nullable -> remplissage depuis l'UUID -> NOT NULL.
ALTER TABLE "servers" ADD COLUMN "short_id" varchar(12);--> statement-breakpoint
UPDATE "servers" SET "short_id" = substr(replace("id"::text, '-', ''), 1, 10) WHERE "short_id" IS NULL;--> statement-breakpoint
ALTER TABLE "servers" ALTER COLUMN "short_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD CONSTRAINT "servers_short_id_unique" UNIQUE("short_id");
