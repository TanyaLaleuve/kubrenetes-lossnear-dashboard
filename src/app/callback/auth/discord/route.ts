import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { discordConfigured, fetchDiscordProfile, publicOrigin } from "@/lib/auth/discord";

/**
 * Callback OAuth Discord (URL publique : dashboard.lossnear.com/callback/auth/discord).
 * Trois cas :
 *  1. Ce Discord est déjà lié à un compte -> connexion à ce compte.
 *  2. Session ouverte (compte k8s) sans Discord lié -> on lie ce Discord au compte.
 *  3. Sinon -> création d'un compte public (origin=bot) lié à ce Discord.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = publicOrigin(request);
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/bot/login?error=${reason}`);

  if (!discordConfigured()) return fail("config");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const session = await getSession();

  // Anti-CSRF : l'état doit correspondre à celui posé au démarrage.
  if (!code || !state || !session.oauthState || state !== session.oauthState) {
    return fail("state");
  }
  session.oauthState = undefined;

  let profile;
  try {
    profile = await fetchDiscordProfile(code);
  } catch {
    return fail("exchange");
  }

  // 1. Déjà lié.
  const [linked] = await db()
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.discordId, profile.id))
    .limit(1);
  if (linked) {
    session.userId = linked.id;
    session.loggedIn = true;
    await session.save();
    return NextResponse.redirect(`${origin}/bot`);
  }

  // 2. Session existante à lier (compte k8s sans Discord).
  if (session.loggedIn && session.userId) {
    await db()
      .update(schema.users)
      .set({ discordId: profile.id, updatedAt: new Date() })
      .where(eq(schema.users.id, session.userId));
    await session.save();
    return NextResponse.redirect(`${origin}/bot`);
  }

  // 3. Création d'un compte public origin=bot.
  const username = await freeUsername(profile.globalName || profile.username);
  const passwordHash = await hash(randomBytes(24).toString("hex"), 10);
  const [created] = await db()
    .insert(schema.users)
    .values({
      username,
      origin: "bot",
      discordId: profile.id,
      passwordHash,
    })
    .returning({ id: schema.users.id });

  session.userId = created.id;
  session.loggedIn = true;
  await session.save();
  return NextResponse.redirect(`${origin}/bot`);
}

/** Trouve un nom d'utilisateur libre à partir d'une base (unicité insensible à la casse). */
async function freeUsername(base: string): Promise<string> {
  const cleaned = (base || "membre").replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 24) || "membre";
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? cleaned : `${cleaned}-${randomBytes(2).toString("hex")}`.slice(0, 32);
    const [taken] = await db()
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`lower(${schema.users.username}) = ${candidate.toLowerCase()}`)
      .limit(1);
    if (!taken) return candidate;
  }
  return `membre-${randomBytes(4).toString("hex")}`;
}
