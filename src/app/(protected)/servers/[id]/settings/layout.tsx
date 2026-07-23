import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { SettingsNav } from "@/components/SettingsNav";
import { currentUser } from "@/lib/auth/user";
import { serverAccess } from "@/lib/servers/authz";

export const dynamic = "force-dynamic";

export const metadata = { title: "Paramètres du serveur" };

export default async function ServerSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  // Section Paramètres accessible si au moins un onglet l'est : propriétaire/
  // admin, ou une permission settings.*/members.read spécifique. Chaque
  // sous-page vérifie ensuite sa propre permission.
  const tabs = {
    general: !!access && (access.privileged || access.permissions.has("settings.general")),
    startup: !!access && (access.privileged || access.permissions.has("settings.egg")),
    management: !!access && (access.privileged || access.permissions.has("settings.manage")),
  };
  if (!access || !Object.values(tabs).some(Boolean)) {
    redirect(`/servers/${id}`);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href={`/servers/${id}`}
          aria-label="Retour au serveur"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-mono text-lg font-semibold">
            {access.server.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Configuration et gestion du serveur
          </p>
        </div>
      </header>

      <SettingsNav serverId={id} tabs={tabs} />

      <main>{children}</main>
    </div>
  );
}
