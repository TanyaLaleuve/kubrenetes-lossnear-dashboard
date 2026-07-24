import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ServerEggForm } from "@/components/ServerEggForm";
import { ServerHeader } from "@/components/ServerHeader";
import { ServerNav } from "@/components/ServerNav";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import { serverAccess } from "@/lib/servers/authz";
import { serverNavProps } from "@/lib/servers/nav";

export const dynamic = "force-dynamic";

export const metadata = { title: "Startup" };

export default async function ServerStartupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  const canEdit =
    !!access && (access.privileged || access.permissions.has("settings.egg"));
  if (!access || !canEdit) redirect(`/servers/${id}`);

  let egg = null;
  if (access.server.eggId) {
    const rows = await db()
      .select()
      .from(schema.eggs)
      .where(eq(schema.eggs.id, access.server.eggId))
      .limit(1);
    egg = rows[0] ?? null;
  }

  return (
    <div className="space-y-6">
      <ServerHeader
        name={access.server.name}
        subtitle="Image Docker et variables de démarrage"
      />

      <ServerNav {...serverNavProps(access)} />

      <ServerEggForm
        server={access.server}
        egg={egg}
        canEdit={canEdit}
        canEditStartupCommand={
          access.privileged || access.permissions.has("settings.startup_command")
        }
      />
    </div>
  );
}
