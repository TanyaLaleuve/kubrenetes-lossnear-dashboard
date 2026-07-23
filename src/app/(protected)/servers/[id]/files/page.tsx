import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { FileManager } from "@/components/FileManager";
import { SftpInfo } from "@/components/SftpInfo";
import { currentUser } from "@/lib/auth/user";
import { serverAccess } from "@/lib/servers/authz";
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
            {server.name}
          </h1>
          <p className="text-xs text-muted-foreground">Fichiers du serveur</p>
        </div>
      </header>

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
