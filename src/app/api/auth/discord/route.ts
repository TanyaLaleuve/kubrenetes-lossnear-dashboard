import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { discordAuthorizeUrl, discordConfigured, publicOrigin } from "@/lib/auth/discord";

/**
 * Démarre la connexion Discord (OAuth) : pose un état anti-CSRF en session puis
 * redirige vers Discord. Tant que l'application Discord n'est pas configurée,
 * renvoie vers la page de connexion bot avec un message.
 */
export async function GET(request: Request) {
  const origin = publicOrigin(request);
  if (!discordConfigured()) {
    return NextResponse.redirect(`${origin}/bot/login?error=config`);
  }
  const session = await getSession();
  const state = randomBytes(16).toString("hex");
  session.oauthState = state;
  await session.save();
  return NextResponse.redirect(discordAuthorizeUrl(state));
}
