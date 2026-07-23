"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/user";
import { sanitizeTheme, type Theme } from "./theme";
import { clearSiteTheme, setSiteTheme } from "./theme-server";

export type ThemeFormState = { error?: string; success?: string };

/**
 * Enregistre la palette globale du site (tout le monde). Réservé aux admins :
 * exportée depuis un fichier "use server", donc atteignable depuis le client,
 * on revérifie le rôle ici.
 */
export async function saveSiteTheme(theme: Partial<Theme>): Promise<ThemeFormState> {
  const user = await currentUser();
  if (!user.isAdmin) return { error: "Réservé aux admins." };

  await setSiteTheme(sanitizeTheme(theme));
  // Le thème est injecté dans le layout racine : on rafraîchit tout.
  revalidatePath("/", "layout");
  return { success: "Palette appliquée à tout le site." };
}

/** Remet la palette par défaut pour tout le monde. */
export async function resetSiteTheme(): Promise<ThemeFormState> {
  const user = await currentUser();
  if (!user.isAdmin) return { error: "Réservé aux admins." };

  await clearSiteTheme();
  revalidatePath("/", "layout");
  return { success: "Palette réinitialisée." };
}
