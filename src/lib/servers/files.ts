import "server-only";
import { coreApi } from "@/lib/k8s/client";
import { env } from "@/lib/env";
import type { SafeUser } from "@/lib/auth/user";
import { requireServerPermission } from "./authz";
import type { Permission } from "./permissions";
import { SERVERS_NAMESPACE } from "./k8s";

/**
 * Nom du dossier de données du serveur sur le stockage local-path.
 * Convention local-path : <pvName>_<namespace>_<pvcName>.
 * Renvoie null si le volume n'existe pas encore (serveur jamais démarré).
 */
export async function resolveVolumeDir(slug: string): Promise<string | null> {
  const pvcName = `data-${slug}-0`;
  try {
    const pvc = await coreApi().readNamespacedPersistentVolumeClaim({
      namespace: SERVERS_NAMESPACE,
      name: pvcName,
    });
    const pv = pvc.spec?.volumeName;
    if (!pv) return null;
    return `${pv}_${SERVERS_NAMESPACE}_${pvcName}`;
  } catch {
    return null;
  }
}

/** Vérifie la permission + résout le volume du serveur. Lève si indisponible. */
export async function serverVolumeFor(
  user: SafeUser,
  id: string,
  permission: Permission,
) {
  const server = await requireServerPermission(user, id, permission);
  const vol = await resolveVolumeDir(server.slug);
  if (!vol) {
    throw new Error(
      "Volume indisponible : démarre le serveur au moins une fois pour créer son disque.",
    );
  }
  return { server, vol };
}

/** Appel à l'agent de nœud pour une opération fichier. */
export async function agentFetch(
  path: string,
  vol: string,
  rel: string,
  init?: RequestInit,
): Promise<Response> {
  const token = env().AGENT_TOKEN;
  if (!token) {
    throw new Error("Agent de nœud non configuré (AGENT_TOKEN manquant).");
  }
  const url = new URL(path, env().AGENT_URL);
  url.searchParams.set("vol", vol);
  url.searchParams.set("path", rel);
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    // Streaming des corps de requête (upload) sans bufferiser.
    ...(init?.body ? { duplex: "half" } : {}),
  } as RequestInit);
}
