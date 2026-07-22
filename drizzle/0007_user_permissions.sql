ALTER TABLE "users" ADD COLUMN "permissions" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
-- Backfill : les comptes existants conservent l'accès complet (les nouveaux
-- comptes reçoivent le set par défaut via l'application).
UPDATE "users" SET "permissions" = '{view.servers,view.overview,view.pods,view.workloads,view.system,view.nodes,view.namespaces}';