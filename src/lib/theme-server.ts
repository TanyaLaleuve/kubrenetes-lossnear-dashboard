import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sanitizeTheme, type Theme } from "./theme";

const GLOBAL_ID = "global";

/**
 * Palette globale enregistrée (partielle, jetons != défaut), ou objet vide si
 * aucune n'est définie ou si la base est injoignable — dans ce cas les valeurs
 * de globals.css s'appliquent.
 */
export async function getSiteTheme(): Promise<Partial<Theme>> {
  try {
    const rows = await db()
      .select({ theme: schema.appSettings.theme })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.id, GLOBAL_ID))
      .limit(1);
    return sanitizeTheme(rows[0]?.theme);
  } catch {
    return {};
  }
}

/** Écrit la palette globale (upsert de l'unique ligne). */
export async function setSiteTheme(theme: Partial<Theme>): Promise<void> {
  const clean = sanitizeTheme(theme);
  await db()
    .insert(schema.appSettings)
    .values({ id: GLOBAL_ID, theme: clean, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.appSettings.id,
      set: { theme: clean, updatedAt: new Date() },
    });
}

/** Efface la palette globale : retour aux valeurs par défaut pour tout le monde. */
export async function clearSiteTheme(): Promise<void> {
  await db()
    .insert(schema.appSettings)
    .values({ id: GLOBAL_ID, theme: null, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.appSettings.id,
      set: { theme: null, updatedAt: new Date() },
    });
}
