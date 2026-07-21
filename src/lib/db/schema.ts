import {
  customType,
  pgEnum,
  pgTable,
  text,
  timestamp,
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

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  email: varchar("email", { length: 255 }).unique(),
  passwordHash: text("password_hash").notNull(),
  origin: accountOrigin("origin").notNull().default("k8s"),
  /** Avatar recadré, toujours stocké en WebP 512×512. */
  avatar: bytea("avatar"),
  /** Compte Discord lié (OAuth à venir). */
  discordId: varchar("discord_id", { length: 32 }).unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
