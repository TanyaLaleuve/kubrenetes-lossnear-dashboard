"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/user";
import { requireServerPermission, serverAccess } from "./authz";
import { agentFetch, resolveVolumeDir } from "./files";
import {
  isKnownProp,
  parseProperties,
  readBooleans,
  setProperty,
  type McPropKey,
} from "./minecraft";

export type McPropsResult =
  | { error: string }
  | { values: Record<McPropKey, boolean>; exists: boolean };

const PROPS_FILE = "server.properties";

/** Lit les booléens de server.properties (défaut Mojang si le fichier manque). */
export async function readMinecraftProps(serverId: string): Promise<McPropsResult> {
  const user = await currentUser();
  const access = await serverAccess(user, serverId);
  if (!access || !access.permissions.has("console.read")) {
    return { error: "Accès refusé." };
  }
  if (!access.server.isMinecraft) return { error: "Serveur non Minecraft." };

  const vol = await resolveVolumeDir(access.server.slug);
  if (!vol) {
    // Volume pas encore créé : on montre les défauts.
    return { values: readBooleans({}), exists: false };
  }
  const res = await agentFetch("/files/read", vol, PROPS_FILE);
  if (!res.ok) {
    // Fichier absent (serveur jamais démarré) : défauts.
    return { values: readBooleans({}), exists: false };
  }
  const text = await res.text();
  return { values: readBooleans(parseProperties(text)), exists: true };
}

/** Bascule une propriété booléenne dans server.properties (effet au redémarrage). */
export async function setMinecraftProp(
  serverId: string,
  key: string,
  value: boolean,
): Promise<McPropsResult> {
  const user = await currentUser();
  // Écrire server.properties = permission fichiers en écriture.
  const server = await requireServerPermission(user, serverId, "files.write");
  if (!server.isMinecraft) return { error: "Serveur non Minecraft." };
  if (!isKnownProp(key)) return { error: "Propriété inconnue." };

  const vol = await resolveVolumeDir(server.slug);
  if (!vol) {
    return { error: "Démarre le serveur au moins une fois pour créer ses fichiers." };
  }

  // On n'édite QUE si l'on a pu lire le fichier existant : sinon on écraserait
  // tout server.properties par une version à une seule clé (perte de données).
  const read = await agentFetch("/files/read", vol, PROPS_FILE);
  if (!read.ok) {
    return {
      error:
        "server.properties introuvable ou illisible. Démarre le serveur une fois pour qu'il génère le fichier, puis réessaie.",
    };
  }
  const current = await read.text();
  const updated = setProperty(current, key, value);

  const write = await agentFetch("/files/write", vol, PROPS_FILE, {
    method: "POST",
    body: updated,
  });
  if (!write.ok) {
    const body = await write.json().catch(() => ({}));
    return { error: body.error ?? "Écriture impossible." };
  }

  revalidatePath(`/servers/${server.shortId}`);
  return { values: readBooleans(parseProperties(updated)), exists: true };
}
