import { redirect } from "next/navigation";
import { ServerHeader } from "@/components/ServerHeader";
import { ServerNav } from "@/components/ServerNav";
import { ActivityLog } from "@/components/ActivityLog";
import { currentUser } from "@/lib/auth/user";
import { serverAccess } from "@/lib/servers/authz";
import { serverNavProps } from "@/lib/servers/nav";
import { listActivity } from "@/lib/servers/activity";

export const dynamic = "force-dynamic";

export const metadata = { title: "Activité" };

export default async function ServerActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  if (!access || !access.permissions.has("activity.read")) {
    redirect(`/servers/${id}`);
  }

  const entries = await listActivity(access.server.id);

  return (
    <div className="space-y-6">
      <ServerHeader
        name={access.server.name}
        subtitle="Journal d'activité — qui a fait quoi (lecture seule)"
      />

      <ServerNav {...serverNavProps(access)} />

      <ActivityLog entries={entries} />
    </div>
  );
}
