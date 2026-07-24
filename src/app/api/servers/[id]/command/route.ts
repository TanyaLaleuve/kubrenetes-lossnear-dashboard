import { Readable, Writable } from "node:stream";
import { Attach } from "@kubernetes/client-node";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sessionUser } from "@/lib/auth/user";
import { getKubeConfig } from "@/lib/k8s/client";
import { requireServerPermission } from "@/lib/servers/authz";
import { logActivity } from "@/lib/servers/activity";
import { SERVERS_NAMESPACE } from "@/lib/servers/k8s";

const bodySchema = z.object({
  command: z.string().trim().min(1).max(500),
});

/**
 * Envoie une commande sur le stdin du processus principal du conteneur
 * (équivalent de taper dans la console du serveur).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await sessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  let server;
  try {
    server = await requireServerPermission(user, id, "console.command");
  } catch {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Commande invalide" }, { status: 400 });
  }

  const podName = `${server.slug}-0`;
  const attach = new Attach(getKubeConfig());
  const stdin = new Readable({ read() {} });
  const devNull = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });

  try {
    const ws = await attach.attach(
      SERVERS_NAMESPACE,
      podName,
      "server",
      devNull,
      devNull,
      stdin,
      false, // pas de tty : cohérent avec le conteneur (stdin simple)
    );
    stdin.push(parsed.data.command + "\n");
    // Laisse le temps à la trame stdin de partir avant de fermer la socket.
    await new Promise((resolve) => setTimeout(resolve, 400));
    stdin.push(null);
    ws.close();
    await logActivity({
      serverId: server.id,
      actor: user,
      action: "console.command",
      detail: `Commande : ${parsed.data.command}`,
    });
  } catch {
    return NextResponse.json(
      { error: "Impossible d'atteindre la console (serveur arrêté ?)" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
