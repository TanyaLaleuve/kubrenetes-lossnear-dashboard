"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/user";
import { loadServerFor } from "./authz";
import { DEFAULT_IMAGE } from "./constants";
import {
  applyServer,
  destroyServer,
  HOST_PORT_MAX,
  HOST_PORT_MIN,
} from "./k8s";

export type ServerFormState = { error?: string };

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nom : 3 caractères minimum")
    .max(48, "Nom : 48 caractères maximum"),
  image: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? DEFAULT_IMAGE : value),
    z
      .string()
      .trim()
      .min(3)
      .max(255)
      .regex(
        /^[a-z0-9][a-z0-9._\/:@-]*$/i,
        "Image Docker invalide (ex. itzg/minecraft-server:latest)",
      ),
  ),
  command: z.string().trim().max(500).optional(),
  containerPort: z.coerce.number().int().min(1).max(65535).default(25565),
  cpuMilli: z.coerce.number().int().min(250).max(16000),
  memoryMi: z.coerce.number().int().min(256).max(32768),
  diskGi: z.coerce.number().int().min(1).max(200),
  env: z.string().optional(), // JSON {clé: valeur} sérialisé par le formulaire
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `srv-${base || "server"}-${suffix}`.slice(0, 40);
}

export async function createServer(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  if (!user.canCreateServers && !user.isAdmin) {
    return { error: "Tu n'as pas le droit de créer des serveurs." };
  }

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const input = parsed.data;

  let env: Record<string, string> = {};
  if (input.env) {
    try {
      env = z.record(z.string(), z.string()).parse(JSON.parse(input.env));
    } catch {
      return { error: "Variables d'environnement invalides." };
    }
  }

  const database = db();

  // Quotas : total des ressources des serveurs existants + le nouveau.
  const [usage] = await database
    .select({
      count: sql<number>`count(*)::int`,
      memoryMi: sql<number>`coalesce(sum(${schema.servers.memoryMi}), 0)::int`,
      cpuMilli: sql<number>`coalesce(sum(${schema.servers.cpuMilli}), 0)::int`,
      diskGi: sql<number>`coalesce(sum(${schema.servers.diskGi}), 0)::int`,
    })
    .from(schema.servers)
    .where(eq(schema.servers.ownerId, user.id));

  if (!user.isAdmin) {
    if (usage.count + 1 > user.quotaMaxServers)
      return { error: `Quota atteint : ${user.quotaMaxServers} serveur(s) max.` };
    if (usage.memoryMi + input.memoryMi > user.quotaMemoryMi)
      return { error: `Quota RAM dépassé (${user.quotaMemoryMi} Mio au total).` };
    if (usage.cpuMilli + input.cpuMilli > user.quotaCpuMilli)
      return { error: `Quota CPU dépassé (${user.quotaCpuMilli} millicœurs au total).` };
    if (usage.diskGi + input.diskGi > user.quotaDiskGi)
      return { error: `Quota disque dépassé (${user.quotaDiskGi} Gio au total).` };
  }

  // Allocation de port : premier libre de la plage.
  const used = await database
    .select({ hostPort: schema.servers.hostPort })
    .from(schema.servers);
  const usedPorts = new Set(used.map((r) => r.hostPort));
  let hostPort: number | null = null;
  for (let p = HOST_PORT_MIN; p <= HOST_PORT_MAX; p++) {
    if (!usedPorts.has(p)) {
      hostPort = p;
      break;
    }
  }
  if (hostPort === null) {
    return { error: "Plus aucun port disponible sur la plage dédiée." };
  }

  const [server] = await database
    .insert(schema.servers)
    .values({
      ownerId: user.id,
      name: input.name,
      slug: slugify(input.name),
      image: input.image,
      command: input.command || null,
      env,
      hostPort,
      containerPort: input.containerPort,
      cpuMilli: input.cpuMilli,
      memoryMi: input.memoryMi,
      diskGi: input.diskGi,
      desiredState: "stopped",
    })
    .returning();

  await applyServer(server);
  revalidatePath("/servers");
  redirect(`/servers/${server.id}`);
}

async function setDesiredState(id: string, state: "running" | "stopped") {
  const user = await currentUser();
  const server = await loadServerFor(user, id);
  const [updated] = await db()
    .update(schema.servers)
    .set({ desiredState: state, updatedAt: new Date() })
    .where(eq(schema.servers.id, server.id))
    .returning();
  await applyServer(updated);
  revalidatePath(`/servers/${id}`);
  revalidatePath("/servers");
}

export async function startServer(id: string) {
  await setDesiredState(id, "running");
}

export async function stopServer(id: string) {
  await setDesiredState(id, "stopped");
}

export async function restartServer(id: string) {
  const user = await currentUser();
  const server = await loadServerFor(user, id);
  if (server.desiredState !== "running") {
    throw new Error("Le serveur n'est pas démarré.");
  }
  // Suppression du pod : le StatefulSet le recrée aussitôt.
  const { coreApi } = await import("@/lib/k8s/client");
  const { SERVERS_NAMESPACE } = await import("./k8s");
  await coreApi().deleteNamespacedPod({
    namespace: SERVERS_NAMESPACE,
    name: `${server.slug}-0`,
  });
  revalidatePath(`/servers/${id}`);
}

export async function deleteServer(id: string) {
  const user = await currentUser();
  const server = await loadServerFor(user, id);
  await destroyServer(server);
  await db().delete(schema.servers).where(eq(schema.servers.id, server.id));
  revalidatePath("/servers");
  redirect("/servers");
}

const addressSchema = z
  .string()
  .trim()
  .max(255)
  .regex(/^[a-z0-9.:-]*$/i, "Adresse invalide (ex. play.lossnear.com)");

/** Adresse affichée aux joueurs (domaine) — owner ou admin. Vide = IP:port. */
export async function updateServerAddress(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const id = String(formData.get("serverId") ?? "");
  const server = await loadServerFor(user, id);

  const parsed = addressSchema.safeParse(formData.get("displayAddress") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db()
    .update(schema.servers)
    .set({ displayAddress: parsed.data || null, updatedAt: new Date() })
    .where(eq(schema.servers.id, server.id));
  revalidatePath(`/servers/${id}`);
  return {};
}

/** Transfert de propriété — owner actuel ou admin. */
export async function transferServer(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const id = String(formData.get("serverId") ?? "");
  const newOwnerId = String(formData.get("newOwnerId") ?? "");
  const server = await loadServerFor(user, id);

  if (!z.string().uuid().safeParse(newOwnerId).success) {
    return { error: "Utilisateur invalide." };
  }
  const target = await db()
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, newOwnerId))
    .limit(1);
  if (!target[0]) return { error: "Utilisateur introuvable." };

  await db()
    .update(schema.servers)
    .set({ ownerId: newOwnerId, updatedAt: new Date() })
    .where(eq(schema.servers.id, server.id));
  revalidatePath(`/servers/${id}`);
  revalidatePath("/servers");
  return {};
}

// ---- Administration (droits + quotas) ----

const quotaSchema = z.object({
  userId: z.string().uuid(),
  canCreateServers: z.coerce.boolean(),
  quotaMaxServers: z.coerce.number().int().min(0).max(100),
  quotaMemoryMi: z.coerce.number().int().min(0).max(262144),
  quotaCpuMilli: z.coerce.number().int().min(0).max(64000),
  quotaDiskGi: z.coerce.number().int().min(0).max(2000),
});

export async function updateUserGrants(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const admin = await currentUser();
  if (!admin.isAdmin) return { error: "Réservé aux admins." };

  const parsed = quotaSchema.safeParse({
    userId: formData.get("userId"),
    canCreateServers: formData.get("canCreateServers") === "on",
    quotaMaxServers: formData.get("quotaMaxServers"),
    quotaMemoryMi: formData.get("quotaMemoryMi"),
    quotaCpuMilli: formData.get("quotaCpuMilli"),
    quotaDiskGi: formData.get("quotaDiskGi"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Un admin ne peut pas se retirer ses propres droits par accident.
  await db()
    .update(schema.users)
    .set({
      canCreateServers: parsed.data.canCreateServers,
      quotaMaxServers: parsed.data.quotaMaxServers,
      quotaMemoryMi: parsed.data.quotaMemoryMi,
      quotaCpuMilli: parsed.data.quotaCpuMilli,
      quotaDiskGi: parsed.data.quotaDiskGi,
      updatedAt: new Date(),
    })
    .where(
      and(eq(schema.users.id, parsed.data.userId), ne(schema.users.id, admin.id)),
    );

  revalidatePath("/admin/users");
  return {};
}
