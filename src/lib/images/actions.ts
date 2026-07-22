"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/user";

export type ImageFormState = { error?: string; success?: string };

const imageRefRegex = /^[a-z0-9][a-z0-9._\/:@-]*$/i;

const addSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(3, "Référence trop courte")
    .max(255)
    .regex(imageRefRegex, "Référence d'image invalide (ex. itzg/minecraft-server:latest)"),
  label: z.string().trim().max(128).optional(),
  category: z.string().trim().max(64).optional(),
});

async function requireAdmin() {
  const user = await currentUser();
  if (!user.isAdmin) throw new Error("Réservé aux admins.");
  return user;
}

/** Ajoute une image au catalogue (ou met à jour libellé/catégorie si elle existe). */
export async function addImage(
  _prev: ImageFormState,
  formData: FormData,
): Promise<ImageFormState> {
  const user = await currentUser();
  if (!user.isAdmin) return { error: "Réservé aux admins." };

  const parsed = addSchema.safeParse({
    reference: formData.get("reference"),
    label: formData.get("label") || undefined,
    category: formData.get("category") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  await db()
    .insert(schema.dockerImages)
    .values({
      reference: input.reference,
      label: input.label || null,
      category: input.category || null,
      source: "manual",
    })
    .onConflictDoUpdate({
      target: schema.dockerImages.reference,
      set: {
        label: input.label || null,
        category: input.category || null,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/images");
  return { success: `Image « ${input.reference} » enregistrée.` };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().trim().max(128).optional(),
  category: z.string().trim().max(64).optional(),
});

/** Met à jour le libellé et la catégorie d'une image du catalogue. */
export async function updateImage(
  _prev: ImageFormState,
  formData: FormData,
): Promise<ImageFormState> {
  const user = await currentUser();
  if (!user.isAdmin) return { error: "Réservé aux admins." };

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    label: formData.get("label") || undefined,
    category: formData.get("category") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db()
    .update(schema.dockerImages)
    .set({
      label: parsed.data.label || null,
      category: parsed.data.category || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.dockerImages.id, parsed.data.id));

  revalidatePath("/images");
  return { success: "Image mise à jour." };
}

export async function deleteImage(id: string) {
  await requireAdmin();
  await db().delete(schema.dockerImages).where(eq(schema.dockerImages.id, id));
  revalidatePath("/images");
}

/**
 * Ajoute au catalogue les images d'un egg (à l'import/sauvegarde). N'écrase
 * pas une entrée existante (catégorie/libellé posés à la main sont conservés).
 * Appelé côté serveur depuis les actions d'egg — pas une action de formulaire.
 */
export async function upsertEggImages(
  images: Record<string, string>,
): Promise<void> {
  const rows = Object.entries(images)
    .filter(([, ref]) => typeof ref === "string" && ref.trim())
    .map(([label, reference]) => ({
      reference: reference.trim(),
      label: label.trim() || null,
      source: "egg" as const,
    }));
  if (rows.length === 0) return;

  await db().insert(schema.dockerImages).values(rows).onConflictDoNothing({
    target: schema.dockerImages.reference,
  });
}
