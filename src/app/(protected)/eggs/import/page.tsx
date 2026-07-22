import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { EggImportForm } from "@/components/EggImportForm";
import { currentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Importer un egg" };

export default async function EggImportPage() {
  const user = await currentUser();
  if (!user.isAdmin) redirect("/servers");

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href="/eggs"
          aria-label="Retour aux templates"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Importer un egg Pterodactyl</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Format JSON d&apos;export (PTDL_v2)
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-5">
        <EggImportForm />
      </div>
    </div>
  );
}
