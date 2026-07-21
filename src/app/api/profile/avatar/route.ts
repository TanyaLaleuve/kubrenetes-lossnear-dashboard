import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/** Limite après recadrage client (le fichier original est limité à 5 Mo côté client). */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.loggedIn || !session.userId) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image trop lourde (2 Mo max après recadrage)" }, { status: 413 });
  }

  let processed: Buffer;
  try {
    // Ré-encodage systématique : neutralise tout fichier malveillant déguisé
    // en image et normalise le format (WebP 512×512).
    processed = await sharp(Buffer.from(await file.arrayBuffer()))
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 88 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Image illisible" }, { status: 415 });
  }

  await db()
    .update(schema.users)
    .set({ avatar: processed, updatedAt: new Date() })
    .where(eq(schema.users.id, session.userId));

  return NextResponse.json({ ok: true });
}
