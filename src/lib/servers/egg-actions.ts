"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import {
  DEFAULT_INSTALL_CONTAINER,
  DEFAULT_INSTALL_ENTRYPOINT,
  parsePterodactylEgg,
  type EggVariable,
} from "./eggs";
import { upsertEggImages } from "@/lib/images/actions";

export type EggFormState = { error?: string };

/** Réservé aux admins : la bibliothèque d'eggs est partagée. */
async function requireAdmin() {
  const user = await currentUser();
  if (!user.isAdmin) throw new Error("Réservé aux admins.");
  return user;
}

/** Parse un bloc texte « libellé = image » (une variante par ligne). */
function parseImagesText(text: string): Record<string, string> {
  const images: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      images[trimmed] = trimmed;
    } else {
      const label = trimmed.slice(0, eq).trim();
      const image = trimmed.slice(eq + 1).trim();
      if (label && image) images[label] = image;
    }
  }
  return images;
}

const variableSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  envVariable: z.string().min(1),
  defaultValue: z.string().default(""),
  userEditable: z.boolean().default(true),
  userViewable: z.boolean().default(true),
  rules: z.string().default(""),
});

/** Import d'un egg au format JSON Pterodactyl. */
export async function importEgg(
  _prev: EggFormState,
  formData: FormData,
): Promise<EggFormState> {
  const user = await requireAdmin();
  const jsonText = String(formData.get("json") ?? "").trim();
  if (!jsonText) return { error: "Colle le JSON de l'egg." };

  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return { error: "JSON invalide." };
  }

  let egg;
  try {
    egg = parsePterodactylEgg(raw);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Egg invalide." };
  }

  const [row] = await db()
    .insert(schema.eggs)
    .values({
      name: egg.name,
      description: egg.description,
      author: egg.author,
      category: String(formData.get("category") ?? "").trim() || null,
      dockerImages: egg.dockerImages,
      startup: egg.startup,
      stopCommand: egg.stopCommand,
      installScript: egg.installScript,
      installContainer: egg.installContainer,
      installEntrypoint: egg.installEntrypoint,
      variables: egg.variables,
      source: "imported",
      createdBy: user.id,
    })
    .returning({ id: schema.eggs.id });

  await upsertEggImages(egg.dockerImages);
  revalidatePath("/eggs");
  redirect(`/eggs/${row.id}`);
}

const saveSchema = z.object({
  name: z.string().trim().min(2, "Nom : 2 caractères minimum").max(96),
  description: z.string().trim().max(2000).default(""),
  author: z.string().trim().max(128).optional(),
  category: z.string().trim().max(64).optional(),
  startup: z.string().trim().max(4000).default(""),
  stopCommand: z.string().trim().max(255).optional(),
  installContainer: z.string().trim().max(255).optional(),
  installEntrypoint: z.string().trim().max(64).optional(),
  installScript: z.string().max(20000).optional(),
});

/** Création ou édition d'un egg maison (formulaire). */
export async function saveEgg(
  _prev: EggFormState,
  formData: FormData,
): Promise<EggFormState> {
  const user = await requireAdmin();
  const eggId = String(formData.get("eggId") ?? "").trim();

  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  const dockerImages = parseImagesText(String(formData.get("images") ?? ""));
  if (Object.keys(dockerImages).length === 0) {
    return { error: "Ajoute au moins une image Docker (libellé = image)." };
  }

  let variables: EggVariable[] = [];
  const varsText = String(formData.get("variables") ?? "").trim();
  if (varsText) {
    try {
      variables = z.array(variableSchema).parse(JSON.parse(varsText));
    } catch {
      return { error: "Variables invalides (JSON attendu : tableau d'objets)." };
    }
  }

  const values = {
    name: input.name,
    description: input.description,
    author: input.author || null,
    category: input.category || null,
    dockerImages,
    startup: input.startup,
    stopCommand: input.stopCommand || null,
    installScript: input.installScript?.trim() ? input.installScript : null,
    installContainer: input.installContainer || DEFAULT_INSTALL_CONTAINER,
    installEntrypoint: input.installEntrypoint || DEFAULT_INSTALL_ENTRYPOINT,
    variables,
    updatedAt: new Date(),
  };

  await upsertEggImages(dockerImages);

  if (eggId) {
    if (!z.string().uuid().safeParse(eggId).success) {
      return { error: "Egg invalide." };
    }
    await db().update(schema.eggs).set(values).where(eq(schema.eggs.id, eggId));
    revalidatePath("/eggs");
    revalidatePath(`/eggs/${eggId}`);
    redirect(`/eggs/${eggId}`);
  }

  const [row] = await db()
    .insert(schema.eggs)
    .values({ ...values, source: "custom", createdBy: user.id })
    .returning({ id: schema.eggs.id });
  revalidatePath("/eggs");
  redirect(`/eggs/${row.id}`);
}

export async function deleteEgg(id: string) {
  await requireAdmin();
  await db().delete(schema.eggs).where(eq(schema.eggs.id, id));
  revalidatePath("/eggs");
  redirect("/eggs");
}

/**
 * Réordonne des eggs (glisser-déposer). `ids` = ordre voulu ; chaque egg reçoit
 * `sortOrder` = son rang dans la liste. Appelé par catégorie côté client.
 */
export async function reorderEggs(ids: string[]) {
  await requireAdmin();
  const uuid = z.string().uuid();
  const clean = ids.filter((id) => uuid.safeParse(id).success);
  await db().transaction(async (tx) => {
    for (let i = 0; i < clean.length; i++) {
      await tx
        .update(schema.eggs)
        .set({ sortOrder: i })
        .where(eq(schema.eggs.id, clean[i]));
    }
  });
  revalidatePath("/eggs");
}
