import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { ServerCreateForm } from "@/components/ServerCreateForm";
import { currentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nouveau serveur" };

export default async function NewServerPage() {
  const user = await currentUser();
  if (!user.canCreateServers && !user.isAdmin) {
    redirect("/servers");
  }

  // Les admins ne sont pas limités par les quotas.
  const cap = user.isAdmin
    ? { maxMemoryMi: 32768, maxCpuMilli: 16000, maxDiskGi: 200 }
    : {
        maxMemoryMi: user.quotaMemoryMi,
        maxCpuMilli: user.quotaCpuMilli,
        maxDiskGi: user.quotaDiskGi,
      };

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href="/servers"
          aria-label="Retour aux serveurs"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Nouveau serveur</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Port attribué automatiquement · démarre arrêté
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card p-5">
        <ServerCreateForm {...cap} />
      </div>
    </div>
  );
}
