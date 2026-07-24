import { redirect } from "next/navigation";
import { AiManager } from "@/components/AiManager";
import { ServerHeader } from "@/components/ServerHeader";
import { ServerNav } from "@/components/ServerNav";
import { currentUser } from "@/lib/auth/user";
import { serverAccess } from "@/lib/servers/authz";
import { serverNavProps } from "@/lib/servers/nav";
import { listMcpTokens } from "@/lib/mcp/tokens";

export const dynamic = "force-dynamic";

export const metadata = { title: "Assistant IA" };

export default async function ServerAiPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  if (!access || !access.permissions.has("ai.use")) {
    redirect(`/servers/${id}`);
  }

  const tokens = await listMcpTokens(user.id);

  return (
    <div className="space-y-6">
      <ServerHeader name={access.server.name} subtitle="Piloter le serveur avec une IA" />

      <ServerNav {...serverNavProps(access)} />

      <AiManager tokens={tokens} shellAllowed={access.privileged} />
    </div>
  );
}
