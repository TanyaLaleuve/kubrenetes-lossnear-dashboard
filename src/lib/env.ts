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
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (!cached) {
    cached = schema.parse({
      SESSION_SECRET: process.env.SESSION_SECRET,
      DATABASE_URL: process.env.DATABASE_URL,
      ADMIN_USER: process.env.ADMIN_USER,
      ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    });
  }
  return cached;
}
