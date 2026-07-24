import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
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
    /**
     * Sous-compte créé par un autre utilisateur (via l'invitation sur un
     * serveur) plutôt que par un admin. Conservé pour traçabilité et pour
     * une future conversion en compte indépendant d'un sous-dashboard
     * (Minecraft, bot) une fois ceux-ci construits.
     */
    parentUserId: uuid("parent_user_id").references((): AnyPgColumn => users.id, {
      onDelete: "set null",
    }),
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
    /** Droit de créer des sauvegardes de ses serveurs (accordé par un admin). */
    canBackup: boolean("can_backup").notNull().default(false),
    /**
     * Nombre total de sauvegardes que ce compte peut détenir, tous serveurs
     * confondus. Le propriétaire répartit ce budget entre ses serveurs via
     * servers.backupLimit (somme des backupLimit <= ce quota).
     */
    backupQuota: integer("backup_quota").notNull().default(0),
    /**
     * Ports externes autorisés (contraint choix manuel ET auto). Syntaxe libre :
     * ports et plages séparés par virgules, ex. "25601, 25605, 25610-25615".
     * null/vide = plage globale par défaut (voir HOST_PORT_MIN/MAX).
     */
    portAllowlist: text("port_allowlist"),
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
    /**
     * Identifiant court public (URLs, identifiant SFTP). Plus lisible qu'un
     * UUID ; l'UUID reste la clé primaire interne.
     */
    shortId: varchar("short_id", { length: 12 }).notNull().unique(),
    /** Identifiant DNS-safe utilisé pour les objets Kubernetes. */
    slug: varchar("slug", { length: 40 }).notNull().unique(),
    image: text("image").notNull(),
    /** Arguments de démarrage optionnels (découpés sur les espaces). */
    command: text("command"),
    env: jsonb("env").$type<Record<string, string>>().notNull().default({}),
    hostPort: integer("host_port").notNull().unique(),
    containerPort: integer("container_port").notNull().default(25565),
    /**
     * Nom de domaine du propriétaire (ex. play.lossnear.com), affiché partout
     * à la place de l'IP du nœud : adresse de connexion, SFTP. null = IP.
     */
    displayAddress: varchar("display_address", { length: 255 }),
    /**
     * Afficher `:port` après l'adresse de connexion. À décocher quand un
     * enregistrement SRV (ou un port par défaut) rend le port inutile.
     */
    showPort: boolean("show_port").notNull().default(true),
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
    /**
     * Cloisonnement réseau : true = le serveur ne joint qu'Internet (pas le
     * réseau interne : base, agent, API Kubernetes, services de l'hôte).
     * Défaut volontairement fermé ; ouvrir demande une permission dédiée.
     */
    isolated: boolean("isolated").notNull().default(true),
    /**
     * Nombre de sauvegardes manuelles allouées à ce serveur par son
     * propriétaire (dans la limite de son quota total). 0 = aucune. Sert de
     * plafond : au-delà, il faut supprimer une sauvegarde avant d'en créer.
     */
    backupLimit: integer("backup_limit").notNull().default(0),
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
  /** Catégorie libre pour regrouper les eggs (ex. "Minecraft", "Bots"). */
  category: varchar("category", { length: 64 }),
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

/** Origine d'une image du catalogue : ajoutée à la main ou issue d'un egg. */
export const imageSource = pgEnum("image_source", ["manual", "egg"]);

/**
 * Catalogue d'images Docker : bibliothèque persistante et indépendante des
 * eggs. Alimentée automatiquement à l'import/sauvegarde d'un egg (upsert) et
 * enrichissable à la main. Supprimer un egg ne retire pas ses images d'ici.
 */
export const dockerImages = pgTable("docker_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Référence complète de l'image (ex. ghcr.io/pterodactyl/yolks:java_17). */
  reference: text("reference").notNull().unique(),
  /** Libellé lisible (ex. "Java 17"). */
  label: varchar("label", { length: 128 }),
  /** Catégorie libre pour le regroupement (ex. "Minecraft", "Bots"). */
  category: varchar("category", { length: 64 }),
  source: imageSource("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DockerImage = typeof dockerImages.$inferSelect;

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

/**
 * Type de sauvegarde :
 * - "manual" : créée par le propriétaire, compte dans son quota, restaurable.
 * - "pre_delete" : capture automatique de l'état juste avant suppression du
 *   serveur, invisible au propriétaire (admin uniquement), hors quota.
 */
export const backupKind = pgEnum("backup_kind", ["manual", "pre_delete"]);

/**
 * Sauvegardes de serveurs (archive tar.gz du volume, stockée par l'agent).
 * Les champs `server*` sont dénormalisés pour survivre à la suppression du
 * serveur (cas des sauvegardes pre_delete) : la ligne reste après que le
 * serveur a disparu.
 */
export const backups = pgTable("backups", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** null après suppression du serveur (les pre_delete lui survivent). */
  serverId: uuid("server_id").references(() => servers.id, {
    onDelete: "set null",
  }),
  /** Slug K8s au moment du backup (sert de dossier de stockage). */
  serverSlug: varchar("server_slug", { length: 40 }).notNull(),
  /** Nom lisible au moment du backup. */
  serverName: varchar("server_name", { length: 48 }).notNull(),
  /** Propriétaire au moment du backup (pour l'affichage / regroupement). */
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  kind: backupKind("kind").notNull().default("manual"),
  /** Taille de l'archive en octets (0 tant que le backup n'est pas terminé). */
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
  note: varchar("note", { length: 255 }),
  /** Auteur (null pour une capture automatique avant suppression). */
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Backup = typeof backups.$inferSelect;

export const priceInterval = pgEnum("price_interval", ["hour", "month", "year"]);

/**
 * Métadonnées d'un nœud Kubernetes, purement informatives (K8s ne les stocke
 * pas) : lien vers l'hébergeur, prix. Clé = nom du nœud (identifiant K8s).
 */
export const nodeMeta = pgTable("node_meta", {
  nodeName: varchar("node_name", { length: 255 }).primaryKey(),
  hostingUrl: text("hosting_url"),
  hostingLabel: varchar("hosting_label", { length: 128 }),
  /** Prix en centimes pour éviter les soucis d'arrondi flottant. */
  priceCents: integer("price_cents"),
  priceCurrency: varchar("price_currency", { length: 8 }).notNull().default("EUR"),
  priceInterval: priceInterval("price_interval"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NodeMeta = typeof nodeMeta.$inferSelect;

/**
 * Réglages globaux du site, une seule ligne (id = "global"). `theme` = palette
 * de couleurs appliquée à tout le monde (jetons -> code hexa), null = valeurs
 * par défaut de globals.css.
 */
export const appSettings = pgTable("app_settings", {
  id: varchar("id", { length: 16 }).primaryKey().default("global"),
  theme: jsonb("theme").$type<Record<string, string>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppSettings = typeof appSettings.$inferSelect;
