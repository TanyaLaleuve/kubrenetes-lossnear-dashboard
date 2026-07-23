"use server";

import { hash } from "bcryptjs";
import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/user";
import { requirePrivileged, requireServerPermission, serverAccess } from "./authz";
import { DEFAULT_IMAGE } from "./constants";
import { DEFAULT_MEMBER_PERMISSIONS, sanitizePermissions } from "./permissions";
import { builtinVars, EGG_MOUNT_PATH, resolveEnv } from "./eggs";
import {
  AUTO_PORT_MAX,
  AUTO_PORT_MIN,
  isReservedPort,
  parsePortSpec,
  PORT_MAX,
  PORT_MIN,
  userAllowedPorts,
} from "./ports";
import {
  canChoosePort,
  DEFAULT_DASHBOARD_PERMISSIONS,
  sanitizeDashboardPermissions,
} from "@/lib/auth/dashboard-permissions";
import {
  applyServer,
  clusterHostPorts,
  destroyServer,
  forceDeletePod,
  updateServerWorkload,
  SERVERS_NAMESPACE,
} from "./k8s";

export type ServerFormState = { error?: string; success?: string };

/**
 * Drizzle enveloppe l'erreur postgres du driver dans une DrizzleQueryError :
 * le vrai code d'erreur ("23505" = contrainte unique violée) est sur
 * `.cause.code`, pas directement sur `.code`.
 */
function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown) =>
    typeof e === "object" && e !== null && "code" in e
      ? (e as { code?: string }).code
      : undefined;
  return (
    code(error) === "23505" ||
    code((error as { cause?: unknown } | null)?.cause) === "23505"
  );
}

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
      .min(PORT_MIN, `Port externe : ${PORT_MIN}-${PORT_MAX}`)
      .max(PORT_MAX, `Port externe : ${PORT_MIN}-${PORT_MAX}`)
      .optional(),
  );
}

/**
 * Identifiant court public (10 caractères). Alphabet sans caractères
 * ambigus (0/o, 1/l/i) pour rester lisible et dictable.
 */
function newShortId(): string {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
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
  const clusterPorts = await clusterHostPorts();
  // null = aucune restriction : n'importe quel port non réservé.
  const allowed = userAllowedPorts(user);

  // Port demandé explicitement : uniquement si l'utilisateur a la permission.
  // Sinon on ignore et on attribue automatiquement.
  if (desiredPort != null && canChoosePort(user)) {
    const problem = portProblem(desiredPort, allowed, usedPorts, clusterPorts);
    if (problem) return { error: problem };
    return { hostPort: desiredPort };
  }

  // Sinon : premier port libre — dans la liste allouée si définie, sinon dans
  // la plage d'attribution automatique (déjà ouverte au pare-feu).
  const candidates =
    allowed ??
    Array.from(
      { length: AUTO_PORT_MAX - AUTO_PORT_MIN + 1 },
      (_, i) => AUTO_PORT_MIN + i,
    );
  for (const p of candidates) {
    if (!portProblem(p, allowed, usedPorts, clusterPorts)) return { hostPort: p };
  }
  return {
    error: allowed
      ? "Plus aucun port disponible dans ta liste allouée."
      : `Plus aucun port libre dans la plage d'attribution automatique (${AUTO_PORT_MIN}-${AUTO_PORT_MAX}). Choisis un port manuellement.`,
  };
}

/**
 * Raison pour laquelle un port ne peut pas être pris, ou null s'il est libre.
 * Partagé par la création, la modification et la vérification en direct.
 */
function portProblem(
  port: number,
  allowed: number[] | null,
  usedPorts: Set<number>,
  clusterPorts: Set<number>,
): string | null {
  if (port < PORT_MIN || port > PORT_MAX) {
    return `Port hors bornes (${PORT_MIN}-${PORT_MAX}).`;
  }
  if (isReservedPort(port)) {
    return `Le port ${port} est réservé (service de l'hôte ou Kubernetes).`;
  }
  if (allowed && !allowed.includes(port)) {
    return `Le port ${port} ne fait pas partie de tes ports autorisés.`;
  }
  if (usedPorts.has(port)) {
    return `Le port ${port} est déjà utilisé par un autre serveur.`;
  }
  if (clusterPorts.has(port)) {
    return `Le port ${port} est déjà occupé sur le nœud.`;
  }
  return null;
}

/** Vérifie en direct la disponibilité d'un port (retour UI immédiat). */
export async function checkPortAvailability(
  port: number,
  serverId?: string,
): Promise<{ ok: boolean; message: string }> {
  const user = await currentUser();
  if (!canChoosePort(user)) {
    return { ok: false, message: "Tu n'as pas la permission de choisir le port." };
  }
  if (!Number.isInteger(port)) {
    return { ok: false, message: "Port invalide." };
  }

  const rows = await db()
    .select({ id: schema.servers.id, hostPort: schema.servers.hostPort })
    .from(schema.servers);
  // Le port actuel du serveur édité ne compte pas comme un conflit.
  const usedPorts = new Set(
    rows.filter((r) => r.id !== serverId).map((r) => r.hostPort),
  );
  const own = rows.find((r) => r.id === serverId)?.hostPort;
  const clusterPorts = await clusterHostPorts();
  if (own != null) clusterPorts.delete(own);

  const problem = portProblem(
    port,
    userAllowedPorts(user),
    usedPorts,
    clusterPorts,
  );
  return problem
    ? { ok: false, message: problem }
    : { ok: true, message: `Port ${port} disponible.` };
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
      shortId: newShortId(),
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
  redirect(`/servers/${server.shortId}`);
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
      shortId: newShortId(),
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
  redirect(`/servers/${server.shortId}`);
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

/**
 * Nom de domaine seul (pas de port, pas de schéma) : il remplace l'IP du nœud
 * partout, y compris dans le lien SFTP, donc il doit rester résolvable tel quel.
 */
const domainSchema = z
  .string()
  .trim()
  .max(253)
  .regex(
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i,
    "Nom de domaine invalide (ex. play.lossnear.com, sans http:// ni port)",
  );

const generalSettingsSchema = z.object({
  serverId: z.string().uuid(),
  name: z.string().trim().min(3, "Nom : 3 caractères minimum").max(48),
  ownerId: z.string().uuid().optional(),
  containerPort: z.coerce.number().int().min(1).max(65535),
  hostPort: z.coerce
    .number()
    .int()
    .min(PORT_MIN, `Port externe : ${PORT_MIN}-${PORT_MAX}`)
    .max(PORT_MAX, `Port externe : ${PORT_MIN}-${PORT_MAX}`),
  cpuMilli: z.coerce.number().int().min(250).max(16000),
  memoryMi: z.coerce.number().int().min(256).max(32768),
  displayAddress: domainSchema.optional(),
  showPort: z.boolean(),
});

/** Mise à jour des paramètres généraux (Nom, ressources, ports, propriétaire, adresse). */
export async function updateServerGeneralSettings(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const access = await serverAccess(user, serverId);
  if (!access || !(access.privileged || access.permissions.has("settings.general"))) {
    return { error: "Accès refusé" };
  }
  const server = access.server;

  const parsed = generalSettingsSchema.safeParse({
    serverId,
    name: formData.get("name"),
    ownerId: formData.get("ownerId") || undefined,
    containerPort: formData.get("containerPort"),
    hostPort: formData.get("hostPort"),
    cpuMilli: formData.get("cpuMilli"),
    memoryMi: formData.get("memoryMi"),
    displayAddress: formData.get("displayAddress") || undefined,
    // Case décochée = champ absent du FormData.
    showPort: formData.get("showPort") !== null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const input = parsed.data;

  // Port externe : modifiable seulement si l'utilisateur a la permission,
  // dans sa plage, et libre. Sinon on garde le port actuel.
  let newHostPort = server.hostPort;
  // On tolère le port actuel inchangé même s'il ne serait plus attribuable
  // (liste allouée modifiée après coup) : on ne valide qu'en cas de changement.
  if (canChoosePort(user) && input.hostPort !== server.hostPort) {
    const others = await db()
      .select({ id: schema.servers.id, hostPort: schema.servers.hostPort })
      .from(schema.servers)
      .where(ne(schema.servers.id, server.id));
    const clusterPorts = await clusterHostPorts();
    clusterPorts.delete(server.hostPort); // son propre pod ne compte pas

    const problem = portProblem(
      input.hostPort,
      userAllowedPorts(user),
      new Set(others.map((r) => r.hostPort)),
      clusterPorts,
    );
    if (problem) return { error: problem };
    newHostPort = input.hostPort;
  }

  const updateData: Record<string, unknown> = {
    name: input.name,
    containerPort: input.containerPort,
    hostPort: newHostPort,
    cpuMilli: input.cpuMilli,
    memoryMi: input.memoryMi,
    displayAddress: input.displayAddress || null,
    showPort: input.showPort,
    // Ligne de démarrage : uniquement avec la permission dédiée (le champ
    // n'est pas rendu sinon, mais on revalide côté serveur).
    ...(access.privileged || access.permissions.has("settings.startup_command")
      ? { startup: String(formData.get("startup") ?? "").trim() || null }
      : {}),
    updatedAt: new Date(),
  };

  // Changer de propriétaire reste réservé au propriétaire actuel/admin, même
  // avec settings.general (donner un serveur à quelqu'un d'autre est plus
  // sensible qu'ajuster ses ressources).
  if (access.privileged && input.ownerId && input.ownerId !== server.ownerId) {
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
  return { success: "Paramètres enregistrés." };
}

/** Mise à jour des paramètres d'Egg (Image Docker, commande startup, variables). */
export async function updateServerEggSettings(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const server = await requireServerPermission(user, serverId, "settings.egg");

  // La ligne de démarrage n'est pas modifiable ici : elle se change depuis
  // les paramètres généraux, avec la permission settings.startup_command.
  const image = String(formData.get("image") ?? "").trim();

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
      env: currentEnv,
      updatedAt: new Date(),
    })
    .where(eq(schema.servers.id, server.id))
    .returning();

  await updateServerWorkload(updated);
  revalidatePath(`/servers/${serverId}`);
  revalidatePath(`/servers/${server.shortId}/startup`);
  return { success: "Configuration enregistrée." };
}

/** Migration du serveur vers un nœud Kubernetes spécifique. */
export async function migrateServerAction(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const server = await requireServerPermission(user, serverId, "settings.manage");

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
  return { success: nodeName ? `Serveur épinglé sur ${nodeName}.` : "Placement remis en automatique." };
}

/** Réinstallation du serveur : suppression du marqueur d'install et relance de l'initContainer. */
export async function reinstallServerAction(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const server = await requireServerPermission(user, serverId, "settings.manage");

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
  return { success: "Réinstallation lancée : le script rejouera au prochain démarrage." };
}

// ---- Membres d'un serveur (sous-utilisateurs) ----

const createSubUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Nom d'utilisateur : 3 caractères minimum")
    .max(32, "Nom d'utilisateur : 32 caractères maximum")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Lettres, chiffres, _ . - uniquement"),
  password: z.string().min(12, "Mot de passe : 12 caractères minimum"),
});

/**
 * Crée un nouveau compte (sous-utilisateur, pas d'accès admin ni de quota de
 * création) et l'ajoute directement comme membre de ce serveur — pour
 * inviter quelqu'un qui n'a pas encore de compte dashboard. Réservé à qui a
 * members.manage sur le serveur. Le compte reste rattaché à son créateur
 * (parentUserId) : base pour une future conversion en compte indépendant
 * d'un sous-dashboard (Minecraft, bot) une fois ceux-ci construits.
 */
export async function createSubUser(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const server = await requireServerPermission(user, serverId, "members.manage");

  const parsed = createSubUserSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  const passwordHash = await hash(input.password, 12);

  // Transaction : le compte ne doit jamais exister sans être ajouté au
  // serveur (sinon on obtient un compte fantôme, non rattaché à rien).
  try {
    await db().transaction(async (tx) => {
      const [created] = await tx
        .insert(schema.users)
        .values({
          username: input.username,
          passwordHash,
          origin: "k8s",
          parentUserId: user.id,
          isAdmin: false,
          canCreateServers: false,
          permissions: sanitizeDashboardPermissions(DEFAULT_DASHBOARD_PERMISSIONS),
          quotaMaxServers: 0,
          quotaMemoryMi: 0,
          quotaCpuMilli: 0,
          quotaDiskGi: 0,
        })
        .returning({ id: schema.users.id });

      await tx.insert(schema.serverMembers).values({
        serverId: server.id,
        userId: created.id,
        permissions: sanitizePermissions(DEFAULT_MEMBER_PERMISSIONS),
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Nom d'utilisateur déjà pris." };
    }
    throw error;
  }

  revalidateMemberPages(server);
  return { success: `Compte « ${input.username} » créé et ajouté au serveur.` };
}

/**
 * Rafraîchit la page des membres. Les URLs portent l'identifiant court, mais
 * les formulaires envoient l'UUID : on rafraîchit les deux.
 */
function revalidateMemberPages(server: { id: string; shortId: string }) {
  revalidatePath(`/servers/${server.shortId}/members`);
  revalidatePath(`/servers/${server.id}/members`);
}

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
      serverId: server.id,
      userId: target.id,
      permissions: sanitizePermissions(
        (await import("./permissions")).DEFAULT_MEMBER_PERMISSIONS,
      ),
    })
    .onConflictDoNothing();

  revalidateMemberPages(server);
  return { success: `« ${identifier} » ajouté au serveur.` };
}

export async function updateMemberPermissions(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const user = await currentUser();
  const serverId = String(formData.get("serverId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const server = await requireServerPermission(user, serverId, "members.manage");

  // Les cases cochées arrivent comme entrées "perm" multiples.
  const permissions = sanitizePermissions(formData.getAll("perm").map(String));

  await db()
    .update(schema.serverMembers)
    .set({ permissions, updatedAt: new Date() })
    .where(
      and(
        eq(schema.serverMembers.serverId, server.id),
        eq(schema.serverMembers.userId, memberId),
      ),
    );
  revalidateMemberPages(server);
  return { success: "Permissions enregistrées." };
}

export async function removeMember(serverId: string, memberId: string) {
  const user = await currentUser();
  const server = await requireServerPermission(user, serverId, "members.manage");
  await db()
    .delete(schema.serverMembers)
    .where(
      and(
        eq(schema.serverMembers.serverId, server.id),
        eq(schema.serverMembers.userId, memberId),
      ),
    );
  revalidateMemberPages(server);
}

// ---- Administration (droits + quotas) ----

const quotaSchema = z.object({
  userId: z.string().uuid(),
  isAdmin: z.coerce.boolean(),
  canCreateServers: z.coerce.boolean(),
  quotaMaxServers: z.coerce.number().int().min(0).max(100),
  quotaMemoryMi: z.coerce.number().int().min(0).max(262144),
  quotaCpuMilli: z.coerce.number().int().min(0).max(64000),
  quotaDiskGi: z.coerce.number().int().min(0).max(2000),
  portAllowlist: z.string().trim().max(500).optional(),
});

export async function updateUserGrants(
  _prev: ServerFormState,
  formData: FormData,
): Promise<ServerFormState> {
  const admin = await currentUser();
  if (!admin.isAdmin) return { error: "Réservé aux admins." };

  const parsed = quotaSchema.safeParse({
    userId: formData.get("userId"),
    isAdmin: formData.get("isAdmin") === "on",
    canCreateServers: formData.get("canCreateServers") === "on",
    quotaMaxServers: formData.get("quotaMaxServers"),
    quotaMemoryMi: formData.get("quotaMemoryMi"),
    quotaCpuMilli: formData.get("quotaCpuMilli"),
    quotaDiskGi: formData.get("quotaDiskGi"),
    portAllowlist: formData.get("portAllowlist"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Ports autorisés : on valide la syntaxe et on normalise (ou null si vide).
  let portAllowlist: string | null = null;
  const spec = parsed.data.portAllowlist?.trim();
  if (spec) {
    try {
      parsePortSpec(spec); // valide la syntaxe et les bornes
      portAllowlist = spec;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Liste de ports invalide." };
    }
  }

  // Un admin ne peut pas modifier son propre compte ici (protection anti-lockout).
  await db()
    .update(schema.users)
    .set({
      isAdmin: parsed.data.isAdmin,
      canCreateServers: parsed.data.canCreateServers,
      quotaMaxServers: parsed.data.quotaMaxServers,
      quotaMemoryMi: parsed.data.quotaMemoryMi,
      quotaCpuMilli: parsed.data.quotaCpuMilli,
      quotaDiskGi: parsed.data.quotaDiskGi,
      portAllowlist,
      updatedAt: new Date(),
    })
    .where(
      and(eq(schema.users.id, parsed.data.userId), ne(schema.users.id, admin.id)),
    );

  revalidatePath("/admin/users");
  return { success: "Droits et quotas enregistrés." };
}
