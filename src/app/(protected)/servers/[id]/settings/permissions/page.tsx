import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { MemberManager } from "@/components/MemberManager";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import { serverAccess } from "@/lib/servers/authz";

export const dynamic = "force-dynamic";

export const metadata = { title: "Permissions du serveur" };

export default async function ServerSettingsPermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  if (
    !access ||
    (!access.privileged &&
      !access.permissions.has("members.read") &&
      !access.permissions.has("members.manage"))
  ) {
    redirect(`/servers/${id}`);
  }

  const canManage = access.privileged || access.permissions.has("members.manage");

  const members = await db()
    .select({
      userId: schema.serverMembers.userId,
      permissions: schema.serverMembers.permissions,
      username: schema.users.username,
      hasAvatar: sql<boolean>`${schema.users.avatar} is not null`,
    })
    .from(schema.serverMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.serverMembers.userId))
    .where(eq(schema.serverMembers.serverId, id));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Membres et Permissions</h2>
          <p className="text-xs text-muted-foreground">
            Accordez l&apos;accès à ce serveur à d&apos;autres utilisateurs et attribuez-leur des permissions spécifiques.
          </p>
        </div>
        <MemberManager serverId={id} members={members} canManage={canManage} />
      </div>
    </div>
  );
}
