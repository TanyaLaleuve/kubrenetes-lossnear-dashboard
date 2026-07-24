import "server-only";
import { env } from "@/lib/env";

/**
 * Intégration Discord OAuth pour le dashboard bot. Tout est optionnel : tant que
 * DISCORD_CLIENT_ID/SECRET ne sont pas fournis, `discordConfigured()` renvoie
 * false et la connexion Discord est simplement indisponible (aucun crash).
 */
export function discordConfigured(): boolean {
  const e = env();
  return Boolean(e.DISCORD_CLIENT_ID && e.DISCORD_CLIENT_SECRET);
}

/** URL d'autorisation Discord (scopes minimaux : identifier le compte). */
export function discordAuthorizeUrl(state: string): string {
  const e = env();
  const params = new URLSearchParams({
    client_id: e.DISCORD_CLIENT_ID,
    redirect_uri: e.DISCORD_REDIRECT_URI,
    response_type: "code",
    scope: "identify",
    state,
    prompt: "consent",
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export type DiscordProfile = {
  id: string;
  username: string;
  /** Nom d'affichage global (peut être null selon le compte). */
  globalName: string | null;
};

/** Échange le code OAuth contre un jeton d'accès, puis lit le profil. */
export async function fetchDiscordProfile(code: string): Promise<DiscordProfile> {
  const e = env();
  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: e.DISCORD_CLIENT_ID,
      client_secret: e.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: e.DISCORD_REDIRECT_URI,
    }),
  });
  if (!tokenRes.ok) throw new Error("Échange du code Discord échoué.");
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Jeton Discord manquant.");

  const userRes = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userRes.ok) throw new Error("Lecture du profil Discord échouée.");
  const u = (await userRes.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
  };
  return { id: u.id, username: u.username, globalName: u.global_name ?? null };
}
