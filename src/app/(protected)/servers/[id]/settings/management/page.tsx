import { redirect } from "next/navigation";
import { ServerManagementForm } from "@/components/ServerManagementForm";
import { currentUser } from "@/lib/auth/user";
import { canOpenNetwork } from "@/lib/auth/dashboard-permissions";
import { listNodes } from "@/lib/k8s/resources";
import { serverAccess } from "@/lib/servers/authz";

export const dynamic = "force-dynamic";

export const metadata = { title: "Gestion & Migration" };

export default async function ServerSettingsManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  const canManage =
    !!access && (access.privileged || access.permissions.has("settings.manage"));
  if (!access || !canManage) redirect(`/servers/${id}`);

  const nodesList = await listNodes().catch(() => []);
  const nodes = nodesList.map((n) => ({
    name: n.metadata?.name ?? "Inconnu",
    ready:
      n.status?.conditions?.some(
        (c) => c.type === "Ready" && c.status === "True",
      ) ?? false,
  }));

  return (
    <div className="space-y-6">
      <ServerManagementForm
        server={access.server}
        nodes={nodes}
        canManage={canManage}
        isPrivileged={access.privileged}
        canOpenNetwork={canOpenNetwork(user)}
      />
    </div>
  );
}
