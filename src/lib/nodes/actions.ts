"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth/user";

export type NodeMetaFormState = { error?: string };

const metaSchema = z.object({
  nodeName: z.string().trim().min(1).max(255),
  hostingUrl: z
    .union([z.string().trim().url("URL invalide"), z.literal("")])
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
    nodeName: formData.get("nodeName"),
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
  return {};
}

export async function deleteNodeMeta(nodeName: string) {
  const user = await currentUser();
  if (!user.isAdmin) return;
  await db().delete(schema.nodeMeta).where(eq(schema.nodeMeta.nodeName, nodeName));
  revalidatePath("/nodes");
}
