import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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
    /**
     * Permissions d'accès aux sections du dashboard (voir
     * lib/auth/dashboard-permissions.ts). Les admins ont tout d'office.
     */
    permissions: text("permissions").array().notNull().default([]),
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
    /** Adresse affichée aux joueurs (ex. play.lossnear.com) à la place de IP:port. */
    displayAddress: varchar("display_address", { length: 255 }),
    cpuMilli: integer("cpu_milli").notNull(),
    memoryMi: integer("memory_mi").notNull(),
    diskGi: integer("disk_gi").notNull(),
    /** Egg d'origine (bibliothèque) — provenance / réinstallation. */
    eggId: uuid("egg_id").references(() => eggs.id, { onDelete: "set null" }),
    /**
     * Commande de démarrage shell (issue de l'egg), exécutée via sh -c avec
     * substitution {{VAR}}. Si null : mode image libre (args = `command`).
     */
    startup: text("startup"),
    stopCommand: varchar("stop_command", { length: 255 }),
    /** Script d'install joué une fois au 1er démarrage (initContainer). */
    installScript: text("install_script"),
    installContainer: varchar("install_container", { length: 255 }),
    installEntrypoint: varchar("install_entrypoint", { length: 64 }),
    /** Point de montage du volume dans le conteneur (egg : /home/container). */
    mountPath: varchar("mount_path", { length: 255 }).notNull().default("/data"),
    /** Nœud Kubernetes assigné (pour la migration / placement statique). */
    nodeName: varchar("node_name", { length: 255 }),
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

/** Provenance d'un egg : importé d'un JSON Pterodactyl ou créé sur mesure. */
export const eggSource = pgEnum("egg_source", ["imported", "custom"]);

/**
 * « Egg » (œuf) = modèle de serveur, façon Pterodactyl : image(s), commande de
 * démarrage, script d'installation et variables configurables. Bibliothèque
 * partagée gérée par les admins ; réutilisée à la création d'un serveur.
 */
export const eggs = pgTable("eggs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 96 }).notNull(),
  description: text("description").notNull().default(""),
  author: varchar("author", { length: 128 }),
  /** Variantes d'image { libellé: image } — au moins une. */
  dockerImages: jsonb("docker_images")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  /** Commande de démarrage (template avec {{VAR}}), exécutée via sh -c. */
  startup: text("startup").notNull().default(""),
  /** Commande d'arrêt gracieux (ex. "stop") ou signal (ex. "^C"). */
  stopCommand: varchar("stop_command", { length: 255 }),
  /** Script d'installation (bash), joué une fois via un initContainer. */
  installScript: text("install_script"),
  installContainer: varchar("install_container", { length: 255 })
    .notNull()
    .default("debian:bookworm-slim"),
  installEntrypoint: varchar("install_entrypoint", { length: 64 })
    .notNull()
    .default("bash"),
  /** Variables configurables (voir EggVariable dans lib/servers/eggs.ts). */
  variables: jsonb("variables")
    .$type<
      {
        name: string;
        description: string;
        envVariable: string;
        defaultValue: string;
        userEditable: boolean;
        userViewable: boolean;
        rules: string;
      }[]
    >()
    .notNull()
    .default([]),
  source: eggSource("source").notNull().default("custom"),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Egg = typeof eggs.$inferSelect;

/**
 * Membres invités sur un serveur (sous-utilisateurs, modèle Pterodactyl).
 * `permissions` = liste de clés (voir lib/servers/permissions.ts).
 * Le propriétaire n'apparaît pas ici : il a toutes les permissions d'office.
 */
export const serverMembers = pgTable(
  "server_members",
  {
    serverId: uuid("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permissions: text("permissions").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.serverId, table.userId] })],
);

export type ServerMember = typeof serverMembers.$inferSelect;
