import { redirect } from "next/navigation";
import { ScheduleManager } from "@/components/ScheduleManager";
import { ServerHeader } from "@/components/ServerHeader";
import { ServerNav } from "@/components/ServerNav";
import { currentUser } from "@/lib/auth/user";
import { serverAccess } from "@/lib/servers/authz";
import { serverNavProps } from "@/lib/servers/nav";
import { listSchedules } from "@/lib/schedules/actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Planificateur" };

export default async function ServerSchedulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  if (!access || !access.permissions.has("schedules.read")) {
    redirect(`/servers/${id}`);
  }

  const raw = await listSchedules(access.server.id);
  const schedules = raw.map((s) => ({
    id: s.id,
    name: s.name,
    cron: s.cron,
    enabled: s.enabled,
    onlyWhenOnline: s.onlyWhenOnline,
    lastRunAt: s.lastRunAt,
    lastStatus: s.lastStatus,
    tasks: s.tasks.map((t) => ({
      type: t.type,
      payload: t.payload,
      delaySeconds: t.delaySeconds,
    })),
  }));

  return (
    <div className="space-y-6">
      <ServerHeader
        name={access.server.name}
        subtitle="Tâches planifiées (fuseau Europe/Paris)"
      />

      <ServerNav {...serverNavProps(access)} />

      <ScheduleManager
        serverId={access.server.id}
        schedules={schedules}
        canManage={access.permissions.has("schedules.manage")}
      />
    </div>
  );
}
