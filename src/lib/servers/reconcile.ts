import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { coreApi } from "@/lib/k8s/client";
import { diskUsage, quotaBytes } from "./disk";
import { resolveVolumeDir } from "./files";
import { applyServer, forceDeletePod, SERVERS_NAMESPACE } from "./k8s";

// Anti crash-loop : si un serveur redémarre CRASH_THRESHOLD fois en moins de
// WINDOW_MS, on le force à l'état "arrêté" au lieu de laisser Kubernetes le
// relancer indéfiniment (CrashLoopBackOff).
const WINDOW_MS = 30_000;
const CRASH_THRESHOLD = 2;
const TICK_MS = 15_000;

type Streak = { baseCount: number; since: number };
const streaks = new Map<string, Streak>();
// Redémarrages volontaires récents (bouton Redémarrer) : ils incrémentent aussi
// restartCount, on ne doit pas les compter comme des crashs.
const expectedRestart = new Map<string, number>();
let started = false;

/** Signale un redémarrage volontaire d'un serveur (à ne pas compter comme crash). */
export function noteExpectedRestart(slug: string) {
  expectedRestart.set(slug, Date.now());
}

// Quota disque : `local-path` n'en applique aucun, donc on arrête tout serveur
// qui dépasse son quota — sinon il peut remplir la partition du nœud et
// entraîner etcd, les autres serveurs et les services voisins avec lui.
const DISK_TICK_MS = 5 * 60_000;

/** Démarre la boucle de surveillance (idempotent, une seule par process). */
export function startCrashLoopReconciler() {
  if (started) return;
  started = true;
  const timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  // N'empêche pas l'arrêt propre du process.
  timer.unref?.();

  const diskTimer = setInterval(() => {
    void diskTick();
  }, DISK_TICK_MS);
  diskTimer.unref?.();
}

/**
 * Arrête les serveurs dont le volume dépasse le quota. Tolérant : si l'agent
 * est injoignable ou le volume non mesuré, on ne fait rien (jamais d'arrêt sur
 * une mesure absente).
 */
async function diskTick() {
  let servers;
  try {
    servers = await db()
      .select()
      .from(schema.servers)
      .where(eq(schema.servers.desiredState, "running"));
  } catch {
    return;
  }
  if (servers.length === 0) return;

  const usage = await diskUsage();
  if (Object.keys(usage.volumes).length === 0) return;

  for (const server of servers) {
    try {
      const vol = await resolveVolumeDir(server.slug);
      const used = vol ? usage.volumes[vol] : undefined;
      if (typeof used !== "number") continue;

      const quota = quotaBytes(server.diskGi);
      if (quota <= 0 || used <= quota) continue;

      const [updated] = await db()
        .update(schema.servers)
        .set({ desiredState: "stopped", updatedAt: new Date() })
        .where(eq(schema.servers.id, server.id))
        .returning();
      if (updated) await applyServer(updated);
      console.warn(
        `[reconcile] ${server.slug} arrêté : quota disque dépassé (${Math.round(
          used / 1024 ** 2,
        )} Mio utilisés pour ${server.diskGi} Gio alloués)`,
      );
    } catch {
      // volume non résolu / erreur ponctuelle : on réessaiera au prochain tour
    }
  }
}

async function tick() {
  let servers;
  try {
    servers = await db()
      .select()
      .from(schema.servers)
      .where(eq(schema.servers.desiredState, "running"));
  } catch {
    return;
  }

  const now = Date.now();

  for (const server of servers) {
    try {
      const pod = await coreApi().readNamespacedPod({
        namespace: SERVERS_NAMESPACE,
        name: `${server.slug}-0`,
      });
      const restarts =
        pod.status?.containerStatuses?.[0]?.restartCount ?? 0;

      if (restarts === 0) {
        streaks.delete(server.slug);
        continue;
      }

      // Redémarrage volontaire récent : on re-baseline (ne compte pas ce
      // restart comme un crash) et on ne déclenche pas le garde-fou.
      const expected = expectedRestart.get(server.slug);
      if (expected !== undefined) {
        if (now - expected < WINDOW_MS) {
          streaks.set(server.slug, { baseCount: restarts, since: now });
          continue;
        }
        expectedRestart.delete(server.slug);
      }

      const prev = streaks.get(server.slug);
      // Nouvelle fenêtre : premier crash observé, ou fenêtre précédente expirée.
      if (!prev || now - prev.since > WINDOW_MS) {
        streaks.set(server.slug, { baseCount: restarts, since: now });
        continue;
      }

      if (restarts - prev.baseCount >= CRASH_THRESHOLD) {
        const [updated] = await db()
          .update(schema.servers)
          .set({ desiredState: "stopped", updatedAt: new Date() })
          .where(eq(schema.servers.id, server.id))
          .returning();
        if (updated) await applyServer(updated); // scale à 0
        // Supprime immédiatement le pod en CrashLoop : sinon il peut retenter
        // un cycle pendant le délai de grâce du scale-à-0.
        await forceDeletePod(server.slug).catch(() => {});
        streaks.delete(server.slug);
        console.warn(
          `[reconcile] ${server.slug} arrêté : ${restarts - prev.baseCount} crashs en moins de ${WINDOW_MS / 1000}s`,
        );
      }
    } catch {
      // Pod absent (scaling en cours, etc.) : on oublie le suivi.
      streaks.delete(server.slug);
    }
  }
}
