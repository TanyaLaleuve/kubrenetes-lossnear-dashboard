import { redirect } from "next/navigation";
import { FileManager } from "@/components/FileManager";
import { ServerHeader } from "@/components/ServerHeader";
import { ServerNav } from "@/components/ServerNav";
import { SftpInfo } from "@/components/SftpInfo";
import { currentUser } from "@/lib/auth/user";
import { serverAccess } from "@/lib/servers/authz";
import { serverNavProps } from "@/lib/servers/nav";
import { PUBLIC_IP } from "@/lib/servers/constants";

export const dynamic = "force-dynamic";

export const metadata = { title: "Fichiers" };

export default async function ServerFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();

  const access = await serverAccess(user, id);
  if (!access || !access.permissions.has("files.read")) {
    redirect(`/servers/${id}`);
  }
  const { server, permissions } = access;
  const canWrite = permissions.has("files.write");
  const canDelete = permissions.has("files.delete");

  return (
    <div className="space-y-6">
      <ServerHeader name={server.name} subtitle="Fichiers du serveur" />

      <ServerNav {...serverNavProps(access)} />

      {permissions.has("files.sftp") && (
        <SftpInfo
          host={PUBLIC_IP}
          port={2222}
          username={`${user.username}.${server.shortId}`}
        />
      )}

      <FileManager serverId={server.id} canWrite={canWrite} canDelete={canDelete} />
    </div>
  );
}
