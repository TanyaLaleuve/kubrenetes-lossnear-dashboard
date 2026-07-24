import "server-only";
import { env } from "@/lib/env";

/**
 * Occupation disque réelle des volumes, mesurée par l'agent de nœud.
 *
 * Le provisionneur `local-path` n'applique aucun quota : la taille demandée
 * dans le PVC est purement indicative et un serveur peut remplir toute la
 * partition du nœud — ce qui casserait etcd, les autres serveurs et les
 * services voisins. C'est donc au dashboard de mesurer et de faire respecter.
 */
export type DiskUsage = {
  /** Octets utilisés, par nom de dossier de volume. */
  volumes: Record<string, number>;
  /** Horodatage de la mesure côté agent (cache de l'agent). */
  scannedAt: number;
};

const EMPTY: DiskUsage = { volumes: {}, scannedAt: 0 };

/** Lit l'usage disque auprès de l'agent. Renvoie du vide si indisponible. */
export async function diskUsage(): Promise<DiskUsage> {
  const token = env().AGENT_TOKEN;
  if (!token) return EMPTY;
  try {
    const url = new URL("/disk/usage", env().AGENT_URL);
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return EMPTY;
    const data = (await response.json()) as Partial<DiskUsage>;
    return {
      volumes: data.volumes ?? {},
      scannedAt: data.scannedAt ?? 0,
    };
  } catch {
    return EMPTY;
  }
}

/** Octets utilisés par un volume donné, ou null si non mesuré. */
export function usageOf(usage: DiskUsage, vol: string | null): number | null {
  if (!vol) return null;
  const bytes = usage.volumes[vol];
  return typeof bytes === "number" ? bytes : null;
}

/** Quota d'un serveur en octets (Gio -> octets). */
export function quotaBytes(diskGi: number): number {
  return diskGi * 1024 ** 3;
}

/** Part du quota consommée (0-1+), ou null si l'usage est inconnu. */
export function quotaRatio(
  used: number | null,
  diskGi: number,
): number | null {
  if (used === null || diskGi <= 0) return null;
  return used / quotaBytes(diskGi);
}
