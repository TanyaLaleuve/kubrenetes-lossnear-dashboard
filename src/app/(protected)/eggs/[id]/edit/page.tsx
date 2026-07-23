import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { EggForm } from "@/components/EggForm";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Modifier le template" };

export default async function EditEggPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user.isAdmin) redirect("/servers");
  const { id } = await params;

  const [egg] = await db()
    .select()
    .from(schema.eggs)
    .where(eq(schema.eggs.id, id))
    .limit(1);
  if (!egg) notFound();

  const rows = await db()
    .select({ category: schema.eggs.category })
    .from(schema.eggs);
  const categories = [
    ...new Set(rows.map((r) => r.category).filter((c): c is string => !!c)),
  ].sort((a, b) => a.localeCompare(b, "fr"));

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href={`/eggs/${id}`}
          aria-label="Retour au template"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{egg.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Modifier le template
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-5">
        <EggForm egg={egg} categories={categories} />
      </div>
    </div>
  );
}
