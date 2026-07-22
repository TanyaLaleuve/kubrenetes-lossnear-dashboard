"use server";

import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/user";
import {
  DEFAULT_DASHBOARD_PERMISSIONS,
  sanitizeDashboardPermissions,
} from "@/lib/auth/dashboard-permissions";

export type AdminFormState = { error?: string; success?: string };

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

const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Nom d'utilisateur : 3 caractères minimum")
    .max(32, "Nom d'utilisateur : 32 caractères maximum")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Lettres, chiffres, _ . - uniquement"),
  email: z
    .union([z.string().trim().toLowerCase().email("Email invalide"), z.literal("")])
    .optional(),
  password: z.string().min(12, "Mot de passe : 12 caractères minimum"),
  canCreateServers: z.boolean(),
  isAdmin: z.boolean(),
  quotaMaxServers: z.coerce.number().int().min(0).max(100).default(1),
  quotaMemoryMi: z.coerce.number().int().min(0).max(262144).default(4096),
  quotaCpuMilli: z.coerce.number().int().min(0).max(64000).default(2000),
  quotaDiskGi: z.coerce.number().int().min(0).max(2000).default(10),
});

/**
 * Création d'un compte par un admin. Origine "k8s" : le compte peut se
 * connecter à ce dashboard (cascade). L'utilisateur pourra changer son mot de
 * passe depuis son profil.
 */
export async function createUser(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await currentUser();
  if (!admin.isAdmin) return { error: "Réservé aux admins." };

  const parsed = createUserSchema.safeParse({
    username: formData.get("username"),
    email: formData.get("email") ?? "",
    password: formData.get("password"),
    canCreateServers: formData.get("canCreateServers") === "on",
    isAdmin: formData.get("isAdmin") === "on",
    quotaMaxServers: formData.get("quotaMaxServers"),
    quotaMemoryMi: formData.get("quotaMemoryMi"),
    quotaCpuMilli: formData.get("quotaCpuMilli"),
    quotaDiskGi: formData.get("quotaDiskGi"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  try {
    await db()
      .insert(schema.users)
      .values({
        username: input.username,
        email: input.email ? input.email : null,
        passwordHash: await hash(input.password, 12),
        origin: "k8s",
        isAdmin: input.isAdmin,
        canCreateServers: input.canCreateServers,
        permissions: sanitizeDashboardPermissions(DEFAULT_DASHBOARD_PERMISSIONS),
        quotaMaxServers: input.quotaMaxServers,
        quotaMemoryMi: input.quotaMemoryMi,
        quotaCpuMilli: input.quotaCpuMilli,
        quotaDiskGi: input.quotaDiskGi,
      });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Nom d'utilisateur ou email déjà utilisé." };
    }
    throw error;
  }

  revalidatePath("/admin/users");
  return { success: `Compte « ${input.username} » créé.` };
}

/** Met à jour les permissions d'accès au dashboard d'un utilisateur. */
export async function updateUserPermissions(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const admin = await currentUser();
  if (!admin.isAdmin) return { error: "Réservé aux admins." };

  const userId = String(formData.get("userId") ?? "");
  if (!z.string().uuid().safeParse(userId).success) {
    return { error: "Utilisateur invalide." };
  }

  // Les cases cochées arrivent comme entrées "perm" multiples.
  const permissions = sanitizeDashboardPermissions(
    formData.getAll("perm").map(String),
  );

  await db()
    .update(schema.users)
    .set({ permissions, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));

  revalidatePath("/admin/users");
  return { success: "Permissions mises à jour." };
}
