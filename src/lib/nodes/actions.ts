"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/user";

export type NodeMetaFormState = { error?: string; success?: string };

/**
 * Normalise une URL saisie à la main : un domaine nu (« contabo.com ») reçoit
 * le préfixe https:// pour rester valide, sans imposer à l'admin de le taper.
 * Ne lève jamais : "" si vide ou si la saisie reste invalide (on préfère
 * enregistrer sans lien plutôt que bloquer tout le formulaire).
 */
function normalizeUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return "";
  }
}

const metaSchema = z.object({
  nodeName: z.string().trim().min(1).max(255),
  hostingUrl: z
    .string()
    .trim()
    .max(255)
    .transform((v) => normalizeUrl(v))
    .optional(),
  hostingLabel: z.string().trim().max(128).optional(),
  priceAmount: z
    .union([z.coerce.number().min(0).max(1_000_000), z.nan()])
    .optional(),
  priceInterval: z.enum(["hour", "month", "year", ""]).optional(),
});

/** Métadonnées informatives d'un nœud (lien hébergeur, prix) — admin only. */
export async function updateNodeMeta(
  _prev: NodeMetaFormState,
  formData: FormData,
): Promise<NodeMetaFormState> {
  const user = await currentUser();
  if (!user.isAdmin) return { error: "Réservé aux admins." };

  const parsed = metaSchema.safeParse({
    nodeName: formData.get("node"),
    hostingUrl: formData.get("hostingUrl") ?? "",
    hostingLabel: formData.get("hostingLabel") ?? "",
    priceAmount: formData.get("priceAmount") || undefined,
    priceInterval: formData.get("priceInterval") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  const priceCents =
    input.priceAmount != null && !Number.isNaN(input.priceAmount)
      ? Math.round(input.priceAmount * 100)
      : null;

  await db()
    .insert(schema.nodeMeta)
    .values({
      nodeName: input.nodeName,
      hostingUrl: input.hostingUrl || null,
      hostingLabel: input.hostingLabel || null,
      priceCents,
      priceInterval: input.priceInterval || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.nodeMeta.nodeName,
      set: {
        hostingUrl: input.hostingUrl || null,
        hostingLabel: input.hostingLabel || null,
        priceCents,
        priceInterval: input.priceInterval || null,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/nodes");
  return { success: "Informations du nœud enregistrées." };
}

export async function deleteNodeMeta(nodeName: string) {
  const user = await currentUser();
  if (!user.isAdmin) return;
  await db().delete(schema.nodeMeta).where(eq(schema.nodeMeta.nodeName, nodeName));
  revalidatePath("/nodes");
}
