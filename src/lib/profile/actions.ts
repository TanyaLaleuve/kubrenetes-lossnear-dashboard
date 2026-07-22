"use server";

import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";

export type ProfileFormState = { error?: string; success?: string };

const usernameSchema = z
  .string()
  .trim()
  .min(3, "3 caractères minimum")
  .max(32, "32 caractères maximum")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Lettres, chiffres, _ . - uniquement");

const emailSchema = z.string().trim().toLowerCase().email("Email invalide");

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

export async function updateUsername(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const session = await requireSession();
  const parsed = usernameSchema.safeParse(formData.get("username"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  try {
    await db()
      .update(schema.users)
      .set({ username: parsed.data, updatedAt: new Date() })
      .where(eq(schema.users.id, session.userId));
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Nom d'utilisateur déjà pris." };
    throw error;
  }
  revalidatePath("/profile");
  return { success: "Nom d'utilisateur mis à jour." };
}

export async function updateEmail(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const session = await requireSession();
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  try {
    await db()
      .update(schema.users)
      .set({ email: parsed.data, updatedAt: new Date() })
      .where(eq(schema.users.id, session.userId));
  } catch (error) {
    if (isUniqueViolation(error)) return { error: "Email déjà utilisé." };
    throw error;
  }
  revalidatePath("/profile");
  return { success: "Email mis à jour." };
}

export async function updatePassword(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const session = await requireSession();
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next.length < 12) {
    return { error: "Nouveau mot de passe : 12 caractères minimum." };
  }
  if (next !== confirm) {
    return { error: "La confirmation ne correspond pas." };
  }

  const rows = await db()
    .select({ passwordHash: schema.users.passwordHash })
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);
  const user = rows[0];
  if (!user || !(await compare(current, user.passwordHash))) {
    return { error: "Mot de passe actuel incorrect." };
  }

  await db()
    .update(schema.users)
    .set({ passwordHash: await hash(next, 12), updatedAt: new Date() })
    .where(eq(schema.users.id, session.userId));

  return { success: "Mot de passe changé." };
}
