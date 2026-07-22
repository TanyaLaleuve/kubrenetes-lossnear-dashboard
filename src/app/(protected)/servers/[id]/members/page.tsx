import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { MemberManager } from "@/components/MemberManager";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import { serverAccess } from "@/lib/servers/authz";

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
            Membres et permissions
          </p>
        </div>
      </header>

      <MemberManager serverId={id} members={members} canManage={canManage} />
    </div>
  );
}
