import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { coreApi } from "@/lib/k8s/client";
import { applyServer, SERVERS_NAMESPACE } from "./k8s";

// Anti crash-loop : si un serveur redémarre CRASH_THRESHOLD fois en moins de
// WINDOW_MS, on le force à l'état "arrêté" au lieu de laisser Kubernetes le
// relancer indéfiniment (CrashLoopBackOff).
const WINDOW_MS = 45_000;
const CRASH_THRESHOLD = 2;
const TICK_MS = 15_000;

type Streak = { baseCount: number; since: number };
const streaks = new Map<string, Streak>();
let started = false;

/** Démarre la boucle de surveillance (idempotent, une seule par process). */
export function startCrashLoopReconciler() {
  if (started) return;
  started = true;
  const timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  // N'empêche pas l'arrêt propre du process.
  timer.unref?.();
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
        if (updated) await applyServer(updated);
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
