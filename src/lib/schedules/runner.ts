import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { Schedule, ScheduleTask, Server } from "@/lib/db/schema";
import { performServerBackup } from "@/lib/servers/backups";
import { agentFetch, resolveVolumeDir } from "@/lib/servers/files";
import { sendConsoleCommand } from "@/lib/servers/exec";
import { forceDeletePod, setReplicas } from "@/lib/servers/k8s";
import { cronMatches } from "./cron";

const TICK_MS = 60_000;
const RUN_HISTORY_KEEP = 20;

let started = false;
// Planifications en cours d'exécution : évite de relancer une chaîne déjà lancée.
const running = new Set<string>();

/** Démarre la boucle du planificateur (idempotente, une seule par process). */
export function startScheduleRunner() {
  if (started) return;
  started = true;
  const timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  // Premier passage rapide au démarrage.
  setTimeout(() => void tick(), 5_000).unref?.();
}

async function tick() {
  const now = new Date();
  now.setSeconds(0, 0);

  let rows: Schedule[];
  try {
    rows = await db()
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.enabled, true));
  } catch {
    return;
  }

  for (const schedule of rows) {
    if (running.has(schedule.id)) continue;
    // Déjà exécutée pour cette minute ?
    if (
      schedule.lastRunAt &&
      Math.floor(schedule.lastRunAt.getTime() / 60_000) ===
        Math.floor(now.getTime() / 60_000)
    ) {
      continue;
    }
    if (!cronMatches(schedule.cron, now)) continue;
    void executeSchedule(schedule.id);
  }
}

/** Exécute une planification maintenant (aussi appelée par « Exécuter »). */
export async function executeSchedule(scheduleId: string): Promise<void> {
  if (running.has(scheduleId)) return;
  running.add(scheduleId);
  try {
    const [schedule] = await db()
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.id, scheduleId))
      .limit(1);
    if (!schedule) return;

    await db()
      .update(schema.schedules)
      .set({ lastRunAt: new Date(), lastStatus: "running" })
      .where(eq(schema.schedules.id, scheduleId));

    const tasks = await db()
      .select()
      .from(schema.scheduleTasks)
      .where(eq(schema.scheduleTasks.scheduleId, scheduleId))
      .orderBy(asc(schema.scheduleTasks.position));

    const log: string[] = [];
    let hadError = false;

    for (const task of tasks) {
      if (task.delaySeconds > 0) {
        await sleep(Math.min(task.delaySeconds, 3600) * 1000);
      }
      // Serveur rechargé à chaque tâche (l'état peut changer entre-temps).
      const [server] = await db()
        .select()
        .from(schema.servers)
        .where(eq(schema.servers.id, schedule.serverId))
        .limit(1);
      if (!server) {
        log.push("serveur introuvable — arrêt");
        hadError = true;
        break;
      }
      try {
        const line = await runTask(server, task);
        log.push(`✓ ${line}`);
      } catch (error) {
        hadError = true;
        log.push(`✗ ${labelTask(task)} : ${error instanceof Error ? error.message : "erreur"}`);
      }
    }

    const status = hadError ? "error" : "ok";
    await db()
      .update(schema.schedules)
      .set({ lastStatus: status })
      .where(eq(schema.schedules.id, scheduleId));
    await db().insert(schema.scheduleRuns).values({
      scheduleId,
      status,
      detail: log.join("\n") || "(aucune tâche)",
    });
    // Purge de l'historique au-delà des N plus récents.
    const olds = await db()
      .select({ id: schema.scheduleRuns.id })
      .from(schema.scheduleRuns)
      .where(eq(schema.scheduleRuns.scheduleId, scheduleId))
      .orderBy(desc(schema.scheduleRuns.startedAt))
      .offset(RUN_HISTORY_KEEP);
    if (olds.length > 0) {
      for (const old of olds) {
        await db().delete(schema.scheduleRuns).where(eq(schema.scheduleRuns.id, old.id));
      }
    }
  } finally {
    running.delete(scheduleId);
  }
}

/** Exécute une tâche unique ; renvoie une ligne descriptive, lève en cas d'échec. */
async function runTask(server: Server, task: ScheduleTask): Promise<string> {
  const p = task.payload ?? {};
  switch (task.type) {
    case "power": {
      const action = p.action;
      switch (action) {
        case "start":
          await db()
            .update(schema.servers)
            .set({ desiredState: "running", updatedAt: new Date() })
            .where(eq(schema.servers.id, server.id));
          await setReplicas(server.slug, 1);
          return "démarrage";
        case "stop":
          await db()
            .update(schema.servers)
            .set({ desiredState: "stopped", updatedAt: new Date() })
            .where(eq(schema.servers.id, server.id));
          await setReplicas(server.slug, 0);
          return "arrêt";
        case "restart":
          await forceDeletePod(server.slug);
          return "redémarrage";
        case "kill":
          await db()
            .update(schema.servers)
            .set({ desiredState: "stopped", updatedAt: new Date() })
            .where(eq(schema.servers.id, server.id));
          await setReplicas(server.slug, 0);
          await forceDeletePod(server.slug);
          return "kill";
        default:
          throw new Error(`action d'alimentation inconnue : ${action}`);
      }
    }
    case "command": {
      const command = p.command ?? "";
      await sendConsoleCommand(server.slug, command);
      return `commande « ${command} »`;
    }
    case "backup": {
      const result = await performServerBackup(server, {
        createdBy: null,
        note: p.note || "Sauvegarde planifiée",
        rotate: true,
      });
      if (result.error) throw new Error(result.error);
      return "sauvegarde créée";
    }
    case "download": {
      const url = p.url ?? "";
      const path = p.path ?? "";
      const vol = await resolveVolumeDir(server.slug);
      if (!vol) throw new Error("volume indisponible");
      const res = await agentFetch("/files/fetch", vol, path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "téléchargement échoué");
      }
      return `téléchargé ${url} → ${path}`;
    }
    default:
      throw new Error(`type de tâche inconnu : ${task.type}`);
  }
}

function labelTask(task: ScheduleTask): string {
  switch (task.type) {
    case "power":
      return `alimentation (${task.payload?.action ?? "?"})`;
    case "command":
      return "commande";
    case "backup":
      return "sauvegarde";
    case "download":
      return "téléchargement";
    default:
      return task.type;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
