import { compare } from "bcryptjs";
import { and, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { resolveVolumeDir } from "@/lib/servers/files";

/**
 * Auth SFTP appelée par l'agent de nœud (jamais exposée publiquement — protégée
 * par le token partagé AGENT_TOKEN). Vérifie identifiants + propriété du serveur
 * et renvoie le dossier de volume à servir.
 */
const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  serverId: z.string().uuid(),
});

export async function POST(request: Request) {
  const token = env().AGENT_TOKEN;
  const auth = request.headers.get("authorization") ?? "";
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { username, password, serverId } = parsed.data;

  const users = await db()
    .select()
    .from(schema.users)
    .where(
      or(
        sql`lower(${schema.users.username}) = ${username.toLowerCase()}`,
        eq(schema.users.email, username.toLowerCase()),
      ),
    )
    .limit(1);
  const user = users[0];
  if (!user || !(await compare(password, user.passwordHash))) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const servers = await db()
    .select()
    .from(schema.servers)
    .where(eq(schema.servers.id, serverId))
    .limit(1);
  const server = servers[0];
  if (!server) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  // Accès SFTP : propriétaire, admin, ou membre avec la permission files.sftp.
  const privileged = user.isAdmin || server.ownerId === user.id;
  if (!privileged) {
    const member = await db()
      .select({ permissions: schema.serverMembers.permissions })
      .from(schema.serverMembers)
      .where(
        and(
          eq(schema.serverMembers.serverId, serverId),
          eq(schema.serverMembers.userId, user.id),
        ),
      )
      .limit(1);
    if (!member[0]?.permissions.includes("files.sftp")) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }
  }

  const vol = await resolveVolumeDir(server.slug);
  if (!vol) {
    return NextResponse.json(
      { ok: false, reason: "volume-absent" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, vol });
}
