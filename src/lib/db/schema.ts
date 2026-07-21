import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Origine du compte dans la cascade de dashboards.
 * "k8s" = dashboard Kubernetes (niveau parent) : seul autorisé à s'y connecter.
 * Les comptes créés depuis un sous-dashboard (minecraft, bot) ne peuvent pas
 * remonter sur le parent.
 */
export const accountOrigin = pgEnum("account_origin", ["k8s", "minecraft", "bot"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Casse libre à l'affichage ; unicité insensible à la casse (index lower). */
    username: varchar("username", { length: 32 }).notNull(),
    email: varchar("email", { length: 255 }).unique(),
    passwordHash: text("password_hash").notNull(),
    origin: accountOrigin("origin").notNull().default("k8s"),
    /** Avatar recadré, toujours stocké en WebP 512×512. */
    avatar: bytea("avatar"),
    /** Compte Discord lié (OAuth à venir). */
    discordId: varchar("discord_id", { length: 32 }).unique(),
    /** Super-admin du panel : gère les droits et quotas des autres comptes. */
    isAdmin: boolean("is_admin").notNull().default(false),
    /** Droit de créer des serveurs custom (accordé par un admin). */
    canCreateServers: boolean("can_create_servers").notNull().default(false),
    quotaMaxServers: integer("quota_max_servers").notNull().default(1),
    quotaMemoryMi: integer("quota_memory_mi").notNull().default(4096),
    quotaCpuMilli: integer("quota_cpu_milli").notNull().default(2000),
    quotaDiskGi: integer("quota_disk_gi").notNull().default(10),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_username_lower_idx").on(sql`lower(${table.username})`),
  ],
);

export type User = typeof users.$inferSelect;

export const serverState = pgEnum("server_state", ["running", "stopped"]);

/**
 * Serveurs custom (jeu, bot, autre) provisionnés dans le namespace
 * lossnear-servers : 1 serveur = StatefulSet + PVC + Service headless.
 * Le port hôte est unique sur la plage 25600-25699 (ouverte dans ufw).
 */
export const servers = pgTable(
  "servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 48 }).notNull(),
    /** Identifiant DNS-safe utilisé pour les objets Kubernetes. */
    slug: varchar("slug", { length: 40 }).notNull().unique(),
    image: text("image").notNull(),
    /** Arguments de démarrage optionnels (découpés sur les espaces). */
    command: text("command"),
    env: jsonb("env").$type<Record<string, string>>().notNull().default({}),
    hostPort: integer("host_port").notNull().unique(),
    containerPort: integer("container_port").notNull().default(25565),
    cpuMilli: integer("cpu_milli").notNull(),
    memoryMi: integer("memory_mi").notNull(),
    diskGi: integer("disk_gi").notNull(),
    desiredState: serverState("desired_state").notNull().default("stopped"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("servers_owner_name_lower_idx").on(
      table.ownerId,
      sql`lower(${table.name})`,
    ),
  ],
);

export type Server = typeof servers.$inferSelect;
