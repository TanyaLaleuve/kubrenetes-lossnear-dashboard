"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/user";
import { requirePrivileged, requireServerPermission } from "./authz";
import { DEFAULT_IMAGE } from "./constants";
import { sanitizePermissions } from "./permissions";
import { builtinVars, EGG_MOUNT_PATH, resolveEnv } from "./eggs";
import {
  applyServer,
  destroyServer,
  forceDeletePod,
  updateServerWorkload,
  HOST_PORT_MAX,
  HOST_PORT_MIN,
  SERVERS_NAMESPACE,
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
  hostPort: optionalHostPort(),
  cpuMilli: z.coerce.number().int().min(250).max(16000),
  memoryMi: z.coerce.number().int().min(256).max(32768),
  diskGi: z.coerce.number().int().min(1).max(200),
  env: z.string().optional(), // JSON {clé: valeur} sérialisé par le formulaire
});

/** Port externe (hostPort) optionnel : vide = attribution automatique. */
function optionalHostPort() {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .coerce.number()
      .int()
      .min(HOST_PORT_MIN, `Port externe : ${HOST_PORT_MIN}-${HOST_PORT_MAX}`)
      .max(HOST_PORT_MAX, `Port externe : ${HOST_PORT_MIN}-${HOST_PORT_MAX}`)
      .optional(),
  );
}

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

type SlotResources = { memoryMi: number; cpuMilli: number; diskGi: number };

/**
 * Vérifie les quotas de l'utilisateur et réserve un port hôte libre.
 * Renvoie le port attribué ou un message d'erreur.
 */
async function reserveSlot(
  user: Awaited<ReturnType<typeof currentUser>>,
  res: SlotResources,
  desiredPort?: number | null,
): Promise<{ hostPort: number } | { error: string }> {
  const database = db();

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
    if (usage.memoryMi + res.memoryMi > user.quotaMemoryMi)
      return { error: `Quota RAM dépassé (${user.quotaMemoryMi} Mio au total).` };
    if (usage.cpuMilli + res.cpuMilli > user.quotaCpuMilli)
      return { error: `Quota CPU dépassé (${user.quotaCpuMilli} millicœurs au total).` };
    if (usage.diskGi + res.diskGi > user.quotaDiskGi)
      return { error: `Quota disque dépassé (${user.quotaDiskGi} Gio au total).` };
  }

  const used = await database
    .select({ hostPort: schema.servers.hostPort })
    .from(schema.servers);
  const usedPorts = new Set(used.map((r) => r.hostPort));

  // Port demandé explicitement : on vérifie qu'il est libre.
  if (desiredPort != null) {
    if (usedPorts.has(desiredPort)) {
      return { error: `Le port ${desiredPort} est déjà utilisé par un autre serveur.` };
    }
    return { hostPort: desiredPort };
  }

  // Sinon : premier port libre de la plage dédiée.
  for (let p = HOST_PORT_MIN; p <= HOST_PORT_MAX; p++) {
    if (!usedPorts.has(p)) return { hostPort: p };
  }
  return { error: "Plus aucun port disponible sur la plage dédiée." };
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

  const slot = await reserveSlot(user, input, input.hostPort);
  if ("error" in slot) return { error: slot.error };
  const hostPort = slot.hostPort;

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

const fromEggSchema = z.object({
  eggId: z.string().uuid(),
  name: z.string().trim().min(3, "Nom : 3 caractères minimum").max(48),
  image: z.string().trim().min(3).max(255),
  containerPort: z.coerce.number().int().min(1).max(65535).default(25565),
  hostPort: optionalHostPort(),
  cpuMilli: z.coerce.number().int().min(250).max(16000),
  memoryMi: z.coerce.number().int().min(256).max(32768),
  diskGi: z.coerce.number().int().min(1).max(200),
});

/** Crée un serveur à partir d'un egg (template) : variables saisies + variante d'image. */
export async function createServerFromEgg(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  if (!user.canCreateServers && !user.isAdmin) {
    return { error: "Tu n'as pas le droit de créer des serveurs." };
  }

  const parsed = fromEggSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  const [egg] = await db()
    .select()
    .from(schema.eggs)
    .where(eq(schema.eggs.id, input.eggId))
    .limit(1);
  if (!egg) return { error: "Template introuvable." };

  // La variante d'image choisie doit appartenir à l'egg.
  const allowedImages = Object.values(egg.dockerImages);
  if (!allowedImages.includes(input.image)) {
    return { error: "Image non autorisée pour ce template." };
  }

  // Valeurs des variables : champ `var_<envVariable>` pour les modifiables.
  const submitted: Record<string, string> = {};
  for (const v of egg.variables) {
    const raw = formData.get(`var_${v.envVariable}`);
    if (typeof raw === "string") submitted[v.envVariable] = raw.trim();
  }
  const env = resolveEnv(
    egg.variables,
    submitted,
    builtinVars({ memoryMi: input.memoryMi, containerPort: input.containerPort }),
  );

  const slot = await reserveSlot(user, input, input.hostPort);
  if ("error" in slot) return { error: slot.error };

  const [server] = await db()
    .insert(schema.servers)
    .values({
      ownerId: user.id,
      name: input.name,
      slug: slugify(input.name),
      image: input.image,
      env,
      hostPort: slot.hostPort,
      containerPort: input.containerPort,
      cpuMilli: input.cpuMilli,
      memoryMi: input.memoryMi,
      diskGi: input.diskGi,
      eggId: egg.id,
      startup: egg.startup,
      stopCommand: egg.stopCommand,
      installScript: egg.installScript,
      installContainer: egg.installContainer,
      installEntrypoint: egg.installEntrypoint,
      mountPath: EGG_MOUNT_PATH,
      desiredState: "stopped",
    })
    .returning();

  await applyServer(server);
  revalidatePath("/servers");
  redirect(`/servers/${server.id}`);
}

async function setDesiredState(
  id: string,
  state: "running" | "stopped",
  permission: string,
) {
  const user = await currentUser();
  const server = await requireServerPermission(user, id, permission);
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
  await setDesiredState(id, "running", "control.start");
}

export async function stopServer(id: string) {
  await setDesiredState(id, "stopped", "control.stop");
}

/** Arrêt dur immédiat : état arrêté + suppression forcée du pod. */
export async function killServer(id: string) {
  const user = await currentUser();
  const server = await requireServerPermission(user, id, "control.kill");
  const [updated] = await db()
    .update(schema.servers)
    .set({ desiredState: "stopped", updatedAt: new Date() })
    .where(eq(schema.servers.id, server.id))
    .returning();
  await applyServer(updated); // scale à 0
  await forceDeletePod(server.slug); // supprime le pod sans délai de grâce
  revalidatePath(`/servers/${id}`);
  revalidatePath("/servers");
}

export async function restartServer(id: string) {
  const user = await currentUser();
  const server = await requireServerPermission(user, id, "control.restart");
  if (server.desiredState !== "running") {
    throw new Error("Le serveur n'est pas démarré.");
  }
  // Suppression du pod : le StatefulSet le recrée aussitôt.
  const { coreApi } = await import("@/lib/k8s/client");
  await coreApi().deleteNamespacedPod({
    namespace: SERVERS_NAMESPACE,
    name: `${server.slug}-0`,
  });
  revalidatePath(`/servers/${id}`);
}

export async function deleteServer(id: string) {
  const user = await currentUser();
  // Action destructive : propriétaire ou admin uniquement.
  const server = await requirePrivileged(user, id);
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
  const server = await requirePrivileged(user, id);

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
  const server = await requirePrivileged(user, id);

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

const generalSettingsSchema = z.object({
  serverId: z.string().uuid(),
  name: z.string().trim().min(3, "Nom : 3 caractères minimum").max(48),
  ownerId: z.string().uuid().optional(),
  containerPort: z.coerce.number().int().min(1).max(65535),
  hostPort: z.coerce
    .number()
    .int()
    .min(HOST_PORT_MIN, `Port externe : ${HOST_PORT_MIN}-${HOST_PORT_MAX}`)
    .max(HOST_PORT_MAX, `Port externe : ${HOST_PORT_MIN}-${HOST_PORT_MAX}`),
  cpuMilli: z.coerce.number().int().min(250).max(16000),
  memoryMi: z.coerce.number().int().min(256).max(32768),
  displayAddress: z.string().trim().max(255).optional(),
});

/** Mise à jour des paramètres généraux (Nom, ressources, ports, propriétaire, adresse). */
export async function updateServerGeneralSettings(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const server = await requirePrivileged(user, serverId);

  const parsed = generalSettingsSchema.safeParse({
    serverId,
    name: formData.get("name"),
    ownerId: formData.get("ownerId") || undefined,
    containerPort: formData.get("containerPort"),
    hostPort: formData.get("hostPort"),
    cpuMilli: formData.get("cpuMilli"),
    memoryMi: formData.get("memoryMi"),
    displayAddress: formData.get("displayAddress") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const input = parsed.data;

  // Port externe : s'il change, vérifier qu'aucun autre serveur ne l'utilise.
  if (input.hostPort !== server.hostPort) {
    const clash = await db()
      .select({ id: schema.servers.id })
      .from(schema.servers)
      .where(
        and(
          eq(schema.servers.hostPort, input.hostPort),
          ne(schema.servers.id, server.id),
        ),
      )
      .limit(1);
    if (clash[0]) {
      return { error: `Le port ${input.hostPort} est déjà utilisé par un autre serveur.` };
    }
  }

  const updateData: Record<string, unknown> = {
    name: input.name,
    containerPort: input.containerPort,
    hostPort: input.hostPort,
    cpuMilli: input.cpuMilli,
    memoryMi: input.memoryMi,
    displayAddress: input.displayAddress || null,
    updatedAt: new Date(),
  };

  if (input.ownerId && input.ownerId !== server.ownerId) {
    const ownerExists = await db()
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, input.ownerId))
      .limit(1);
    if (ownerExists[0]) {
      updateData.ownerId = input.ownerId;
    }
  }

  const [updated] = await db()
    .update(schema.servers)
    .set(updateData)
    .where(eq(schema.servers.id, server.id))
    .returning();

  await updateServerWorkload(updated);
  revalidatePath(`/servers/${serverId}`);
  revalidatePath(`/servers/${serverId}/settings`);
  revalidatePath("/servers");
  return {};
}

/** Mise à jour des paramètres d'Egg (Image Docker, commande startup, variables). */
export async function updateServerEggSettings(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const server = await requirePrivileged(user, serverId);

  const image = String(formData.get("image") ?? "").trim();
  const startup = String(formData.get("startup") ?? "").trim();

  if (!image) return { error: "L'image Docker ne peut pas être vide." };

  let currentEnv: Record<string, string> = { ...server.env };

  // Si le serveur est rattaché à un egg, on peut traiter les variables préfixées par `var_`
  if (server.eggId) {
    const [egg] = await db()
      .select()
      .from(schema.eggs)
      .where(eq(schema.eggs.id, server.eggId))
      .limit(1);

    if (egg) {
      const submitted: Record<string, string> = {};
      for (const v of egg.variables) {
        const raw = formData.get(`var_${v.envVariable}`);
        if (typeof raw === "string") submitted[v.envVariable] = raw.trim();
      }
      currentEnv = resolveEnv(
        egg.variables,
        submitted,
        builtinVars({ memoryMi: server.memoryMi, containerPort: server.containerPort }),
      );
    }
  }

  const [updated] = await db()
    .update(schema.servers)
    .set({
      image,
      startup: startup || server.startup,
      env: currentEnv,
      updatedAt: new Date(),
    })
    .where(eq(schema.servers.id, server.id))
    .returning();

  await updateServerWorkload(updated);
  revalidatePath(`/servers/${serverId}`);
  revalidatePath(`/servers/${serverId}/settings/egg`);
  return {};
}

/** Migration du serveur vers un nœud Kubernetes spécifique. */
export async function migrateServerAction(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const server = await requirePrivileged(user, serverId);

  const targetNode = String(formData.get("nodeName") ?? "").trim();
  const nodeName = targetNode === "" || targetNode === "auto" ? null : targetNode;

  const [updated] = await db()
    .update(schema.servers)
    .set({ nodeName, updatedAt: new Date() })
    .where(eq(schema.servers.id, server.id))
    .returning();

  // nodeName est dans le template du pod : on remplace la spec du StatefulSet.
  await updateServerWorkload(updated);

  // Forcer le redémarrage du pod si le serveur tourne pour déplacer le conteneur.
  if (server.desiredState === "running") {
    await forceDeletePod(server.slug);
  }

  revalidatePath(`/servers/${serverId}`);
  revalidatePath(`/servers/${serverId}/settings/management`);
  return {};
}

/** Réinstallation du serveur : suppression du marqueur d'install et relance de l'initContainer. */
export async function reinstallServerAction(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const server = await requirePrivileged(user, serverId);

  // Tentative de nettoyage du fichier marqueur d'installation via l'agent
  try {
    const { resolveVolumeDir, agentFetch } = await import("./files");
    const vol = await resolveVolumeDir(server.slug);
    if (vol) {
      await agentFetch("/files/delete", vol, ".lossnear-installed", {
        method: "POST",
      }).catch(() => null);
    }
  } catch {
    // Ignorer si le volume n'existe pas encore
  }

  // Redémarrer / Forcer la suppression du pod pour relancer l'initContainer au prochain boot
  if (server.desiredState === "running") {
    await forceDeletePod(server.slug);
  }

  revalidatePath(`/servers/${serverId}`);
  revalidatePath(`/servers/${serverId}/settings/management`);
  return {};
}

// ---- Membres d'un serveur (sous-utilisateurs) ----

/** Invite un membre par nom d'utilisateur (permissions par défaut). */
export async function addMember(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const identifier = String(formData.get("username") ?? "").trim();

  const server = await requireServerPermission(user, serverId, "members.manage");

  const rows = await db()
    .select({ id: schema.users.id, origin: schema.users.origin })
    .from(schema.users)
    .where(sql`lower(${schema.users.username}) = ${identifier.toLowerCase()}`)
    .limit(1);
  const target = rows[0];
  if (!target) return { error: "Utilisateur introuvable." };
  if (target.id === server.ownerId) {
    return { error: "Le propriétaire a déjà tous les droits." };
  }

  await db()
    .insert(schema.serverMembers)
    .values({
      serverId,
      userId: target.id,
      permissions: sanitizePermissions(
        (await import("./permissions")).DEFAULT_MEMBER_PERMISSIONS,
      ),
    })
    .onConflictDoNothing();

  revalidatePath(`/servers/${serverId}/members`);
  return {};
}

export async function updateMemberPermissions(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  await requireServerPermission(user, serverId, "members.manage");

  // Les cases cochées arrivent comme entrées "perm" multiples.
  const permissions = sanitizePermissions(formData.getAll("perm").map(String));

  await db()
    .update(schema.serverMembers)
    .set({ permissions, updatedAt: new Date() })
    .where(
      and(
        eq(schema.serverMembers.serverId, serverId),
        eq(schema.serverMembers.userId, memberId),
      ),
    );
  revalidatePath(`/servers/${serverId}/members`);
  return {};
}

export async function removeMember(serverId: string, memberId: string) {
  const user = await currentUser();
  await requireServerPermission(user, serverId, "members.manage");
  await db()
    .delete(schema.serverMembers)
    .where(
      and(
        eq(schema.serverMembers.serverId, serverId),
        eq(schema.serverMembers.userId, memberId),
      ),
    );
  revalidatePath(`/servers/${serverId}/members`);
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
