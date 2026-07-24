"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/user";
import { requireServerPermission, serverAccess } from "@/lib/servers/authz";
import { isValidCron } from "./cron";
import { executeSchedule } from "./runner";

export type ScheduleFormState = { error?: string; success?: string };

function revalidate(shortId: string, serverUuid: string) {
  revalidatePath(`/servers/${shortId}/schedules`);
  revalidatePath(`/servers/${serverUuid}/schedules`);
}

const taskSchema = z.object({
  type: z.enum(["power", "command", "backup", "download"]),
  delaySeconds: z.coerce.number().int().min(0).max(3600).default(0),
  // Champs selon le type ; on ne garde que les pertinents à l'enregistrement.
  action: z.enum(["start", "stop", "restart", "kill"]).optional(),
  command: z.string().trim().max(500).optional(),
  note: z.string().trim().max(255).optional(),
  url: z.string().trim().max(1000).optional(),
  path: z.string().trim().max(500).optional(),
});

const scheduleSchema = z.object({
  serverId: z.string().uuid(),
  name: z.string().trim().min(1, "Nom requis").max(96),
  cron: z.string().trim().min(1).max(128),
  enabled: z.coerce.boolean().default(true),
  tasks: z.array(taskSchema).max(20),
});

function payloadFor(task: z.infer<typeof taskSchema>): Record<string, string> {
  switch (task.type) {
    case "power":
      return { action: task.action ?? "restart" };
    case "command":
      return { command: task.command ?? "" };
    case "backup":
      return task.note ? { note: task.note } : {};
    case "download":
      return { url: task.url ?? "", path: task.path ?? "" };
  }
}

/** Crée ou met à jour une planification (avec ses tâches). */
export async function saveScheduleAction(
  input: unknown,
): Promise<ScheduleFormState> {
  const user = await currentUser();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const server = await requireServerPermission(
    user,
    data.serverId,
    "schedules.manage",
  );

  if (!isValidCron(data.cron)) {
    return { error: "Récurrence invalide (expression cron incorrecte)." };
  }
  if (data.tasks.length === 0) {
    return { error: "Ajoute au moins une tâche." };
  }
  for (const t of data.tasks) {
    if (t.type === "command" && !t.command) return { error: "Commande vide." };
    if (t.type === "download" && (!t.url || !t.path)) {
      return { error: "Le téléchargement exige une URL et un chemin de destination." };
    }
    if (t.type === "download" && !/^https?:\/\//i.test(t.url ?? "")) {
      return { error: "URL de téléchargement invalide (http/https)." };
    }
  }

  const scheduleId =
    typeof (input as { id?: unknown }).id === "string"
      ? (input as { id: string }).id
      : null;

  await db().transaction(async (tx) => {
    let sid = scheduleId;
    if (sid) {
      await tx
        .update(schema.schedules)
        .set({
          name: data.name,
          cron: data.cron,
          enabled: data.enabled,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.schedules.id, sid),
            eq(schema.schedules.serverId, server.id),
          ),
        );
      await tx.delete(schema.scheduleTasks).where(eq(schema.scheduleTasks.scheduleId, sid));
    } else {
      const [created] = await tx
        .insert(schema.schedules)
        .values({
          serverId: server.id,
          name: data.name,
          cron: data.cron,
          enabled: data.enabled,
        })
        .returning({ id: schema.schedules.id });
      sid = created.id;
    }
    await tx.insert(schema.scheduleTasks).values(
      data.tasks.map((t, i) => ({
        scheduleId: sid!,
        position: i,
        type: t.type,
        payload: payloadFor(t),
        delaySeconds: t.delaySeconds,
      })),
    );
  });

  revalidate(server.shortId, server.id);
  return { success: scheduleId ? "Planification mise à jour." : "Planification créée." };
}

export async function toggleScheduleAction(scheduleId: string, enabled: boolean) {
  const user = await currentUser();
  const schedule = await loadOwnedSchedule(user, scheduleId, "schedules.manage");
  if (!schedule) return;
  await db()
    .update(schema.schedules)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(schema.schedules.id, scheduleId));
  revalidate(schedule.shortId, schedule.serverId);
}

export async function deleteScheduleAction(scheduleId: string) {
  const user = await currentUser();
  const schedule = await loadOwnedSchedule(user, scheduleId, "schedules.manage");
  if (!schedule) return;
  await db().delete(schema.schedules).where(eq(schema.schedules.id, scheduleId));
  revalidate(schedule.shortId, schedule.serverId);
}

/** Lance une planification immédiatement (hors récurrence). */
export async function runScheduleNowAction(
  scheduleId: string,
): Promise<ScheduleFormState> {
  const user = await currentUser();
  const schedule = await loadOwnedSchedule(user, scheduleId, "schedules.manage");
  if (!schedule) return { error: "Planification introuvable." };
  // Non bloquant : l'exécution peut durer (délais entre tâches).
  void executeSchedule(scheduleId);
  return { success: "Exécution lancée." };
}

/** Charge une planification en vérifiant la permission sur son serveur. */
async function loadOwnedSchedule(
  user: Awaited<ReturnType<typeof currentUser>>,
  scheduleId: string,
  permission: string,
) {
  const [schedule] = await db()
    .select({
      id: schema.schedules.id,
      serverId: schema.schedules.serverId,
    })
    .from(schema.schedules)
    .where(eq(schema.schedules.id, scheduleId))
    .limit(1);
  if (!schedule) return null;
  const access = await serverAccess(user, schedule.serverId);
  if (!access || !access.permissions.has(permission)) return null;
  return { ...schedule, shortId: access.server.shortId };
}

/** Liste les planifications d'un serveur avec leurs tâches. */
export async function listSchedules(serverUuid: string) {
  const schedules = await db()
    .select()
    .from(schema.schedules)
    .where(eq(schema.schedules.serverId, serverUuid))
    .orderBy(asc(schema.schedules.createdAt));
  const tasks = await db()
    .select()
    .from(schema.scheduleTasks)
    .orderBy(asc(schema.scheduleTasks.position));
  return schedules.map((s) => ({
    ...s,
    tasks: tasks.filter((t) => t.scheduleId === s.id),
  }));
}
