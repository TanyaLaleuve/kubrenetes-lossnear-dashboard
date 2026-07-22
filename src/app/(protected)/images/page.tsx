import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ImageCatalog, type CatalogItem } from "@/components/ImageCatalog";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Images Docker" };

export default async function ImagesPage() {
  const user = await currentUser();
  if (!user.isAdmin) redirect("/servers");

  const [rows, eggs] = await Promise.all([
    db().select().from(schema.dockerImages).orderBy(asc(schema.dockerImages.reference)),
    db().select({ dockerImages: schema.eggs.dockerImages }).from(schema.eggs),
  ]);

  // Combien d'eggs référencent chaque image (calcul en direct).
  const usage = new Map<string, number>();
  for (const egg of eggs) {
    for (const ref of Object.values(egg.dockerImages)) {
      usage.set(ref, (usage.get(ref) ?? 0) + 1);
    }
  }

  const items: CatalogItem[] = rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    label: r.label,
    category: r.category,
    source: r.source,
    usedBy: usage.get(r.reference) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Images Docker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Catalogue d&apos;images réutilisables · {items.length} image
          {items.length > 1 ? "s" : ""}. Alimenté par les eggs et tes ajouts ;
          les images restent même si l&apos;egg est supprimé.
        </p>
      </header>

      <ImageCatalog items={items} />
    </div>
  );
}
