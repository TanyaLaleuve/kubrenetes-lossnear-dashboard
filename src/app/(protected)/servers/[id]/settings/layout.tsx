import { redirect } from "next/navigation";
import { ServerHeader } from "@/components/ServerHeader";
import { ServerNav } from "@/components/ServerNav";
import { SettingsNav } from "@/components/SettingsNav";
import { currentUser } from "@/lib/auth/user";
import { serverAccess } from "@/lib/servers/authz";
import { serverNavProps } from "@/lib/servers/nav";

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
  // admin, ou une permission settings.* spécifique. Chaque sous-page vérifie
  // ensuite sa propre permission. Startup a sa propre page hors Paramètres.
  const tabs = {
    general: !!access && (access.privileged || access.permissions.has("settings.general")),
    management: !!access && (access.privileged || access.permissions.has("settings.manage")),
  };
  if (!access || !Object.values(tabs).some(Boolean)) {
    redirect(`/servers/${id}`);
  }

  return (
    <div className="space-y-6">
      <ServerHeader
        name={access.server.name}
        subtitle="Configuration et gestion du serveur"
      />

      <ServerNav {...serverNavProps(access)} />

      <SettingsNav serverId={access.server.shortId} tabs={tabs} />

      <main>{children}</main>
    </div>
  );
}
