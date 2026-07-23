import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { MemberManager } from "@/components/MemberManager";
import { ServerHeader } from "@/components/ServerHeader";
import { ServerNav } from "@/components/ServerNav";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import { serverAccess } from "@/lib/servers/authz";
import { serverNavProps } from "@/lib/servers/nav";

export const dynamic = "force-dynamic";

export const metadata = { title: "Permissions" };

export default async function ServerMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  if (!access || !access.permissions.has("members.read")) {
    redirect(`/servers/${id}`);
  }
  const canManage = access.permissions.has("members.manage");

  // L'URL porte l'identifiant court : les requêtes et les actions doivent
  // utiliser l'UUID interne (server_members.server_id est de type uuid).
  const serverId = access.server.id;

  const members = await db()
    .select({
      userId: schema.serverMembers.userId,
      permissions: schema.serverMembers.permissions,
      username: schema.users.username,
      hasAvatar: sql<boolean>`${schema.users.avatar} is not null`,
    })
    .from(schema.serverMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.serverMembers.userId))
    .where(eq(schema.serverMembers.serverId, serverId));

  return (
    <div className="space-y-6">
      <ServerHeader name={access.server.name} subtitle="Membres et permissions" />

      <ServerNav {...serverNavProps(access)} />

      <MemberManager
        serverId={serverId}
        members={members}
        canManage={canManage}
      />
    </div>
  );
}
