import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ServerEggForm } from "@/components/ServerEggForm";
import { currentUser } from "@/lib/auth/user";
import { db, schema } from "@/lib/db";
import { serverAccess } from "@/lib/servers/authz";

export const dynamic = "force-dynamic";

export const metadata = { title: "Configuration Egg" };

export default async function ServerSettingsEggPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  if (!access) redirect("/servers");

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
      <ServerEggForm
        server={access.server}
        egg={egg}
        isPrivileged={access.privileged}
      />
    </div>
  );
}
