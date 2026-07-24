import { asc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ServerGeneralForm } from "@/components/ServerGeneralForm";
import { currentUser } from "@/lib/auth/user";
import { canChoosePort } from "@/lib/auth/dashboard-permissions";
import { portsLabel, userPortBounds } from "@/lib/servers/ports";
import { db, schema } from "@/lib/db";
import { serverAccess } from "@/lib/servers/authz";

export const dynamic = "force-dynamic";

export const metadata = { title: "Paramètres généraux" };

export default async function ServerSettingsGeneralPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  const canEdit =
    !!access && (access.privileged || access.permissions.has("settings.general"));
  if (!access || !canEdit) redirect(`/servers/${id}`);

  // Liste complète des comptes (pour le sélecteur propriétaire) : uniquement
  // envoyée au client si privilégié, pour ne pas exposer tous les usernames
  // à un membre qui n'a que settings.general.
  const usersList = access.privileged
    ? await db()
        .select({ id: schema.users.id, username: schema.users.username })
        .from(schema.users)
        .orderBy(asc(schema.users.username))
    : [];
  const ownerRow = await db()
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, access.server.ownerId))
    .limit(1);

  const bounds = userPortBounds(user);

  return (
    <div className="space-y-6">
      <ServerGeneralForm
        server={access.server}
        users={usersList}
        ownerUsername={ownerRow[0]?.username ?? "?"}
        canEdit={canEdit}
        isPrivileged={access.privileged}
        canChoosePort={canChoosePort(user)}
        portMin={bounds.min}
        portMax={bounds.max}
        portsLabel={portsLabel(user)}
      />
    </div>
  );
}
