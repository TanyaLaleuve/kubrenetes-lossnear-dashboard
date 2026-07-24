import { z } from "zod";

const schema = z.object({
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET doit faire au moins 32 caractères"),
  DATABASE_URL: z.string().startsWith("postgresql://", "URL PostgreSQL attendue"),
  // Bootstrap du tout premier compte admin (utilisés uniquement si la table
  // users est vide au démarrage).
  ADMIN_USER: z.string().min(1),
  ADMIN_PASSWORD_HASH: z.string().startsWith("$2", "hash bcrypt attendu"),
  // Agent de nœud (gestion de fichiers). Optionnels : le gestionnaire de
  // fichiers est simplement indisponible s'ils manquent.
  AGENT_URL: z
    .string()
    .default("http://lossnear-agent.lossnear-system.svc.cluster.local:8080"),
  AGENT_TOKEN: z.string().default(""),
  // Dashboard bot Discord (OAuth + API). Optionnels : la connexion Discord est
  // simplement indisponible tant qu'ils ne sont pas fournis.
  DISCORD_CLIENT_ID: z.string().default(""),
  DISCORD_CLIENT_SECRET: z.string().default(""),
  DISCORD_BOT_TOKEN: z.string().default(""),
  /** URL de callback OAuth (doit être autorisée dans le portail Discord). */
  DISCORD_REDIRECT_URI: z
    .string()
    .default("https://dashboard.lossnear.com/callback/auth/discord"),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (!cached) {
    cached = schema.parse({
      SESSION_SECRET: process.env.SESSION_SECRET,
      DATABASE_URL: process.env.DATABASE_URL,
      ADMIN_USER: process.env.ADMIN_USER,
      ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
      AGENT_URL: process.env.AGENT_URL,
      AGENT_TOKEN: process.env.AGENT_TOKEN,
      DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
      DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
      DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
      DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
    });
  }
  return cached;
}
