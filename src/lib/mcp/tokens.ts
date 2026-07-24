import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sessionUser, type SafeUser } from "@/lib/auth/user";

const PREFIX = "lsk_"; // « lossnear secret key »

/** Hash SHA-256 hexadécimal — stocké en base à la place du jeton en clair. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Crée un jeton MCP pour un utilisateur. Renvoie la valeur EN CLAIR (à montrer
 * une seule fois) ; seul son hash est conservé.
 */
export async function createMcpToken(
  userId: string,
  label: string | null,
): Promise<{ token: string; id: string }> {
  const secret = randomBytes(24).toString("base64url");
  const token = `${PREFIX}${secret}`;
  const [row] = await db()
    .insert(schema.mcpTokens)
    .values({
      userId,
      tokenHash: hashToken(token),
      prefix: token.slice(0, 12),
      label: label?.slice(0, 64) || null,
    })
    .returning({ id: schema.mcpTokens.id });
  return { token, id: row.id };
}

/**
 * Résout un jeton MCP en l'utilisateur associé (SafeUser complet), ou null.
 * Rejette les jetons expirés. Met à jour lastUsedAt au passage.
 */
export async function userFromMcpToken(token: string): Promise<SafeUser | null> {
  if (!token || !token.startsWith(PREFIX)) return null;
  const rows = await db()
    .select({ id: schema.mcpTokens.id, userId: schema.mcpTokens.userId })
    .from(schema.mcpTokens)
    .where(
      and(
        eq(schema.mcpTokens.tokenHash, hashToken(token)),
        or(
          isNull(schema.mcpTokens.expiresAt),
          gt(schema.mcpTokens.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);
  const record = rows[0];
  if (!record) return null;

  // Réutilise le chargement SafeUser via une session simulée n'est pas possible
  // ici : on charge directement l'utilisateur par son id.
  const { loadSafeUser } = await import("@/lib/auth/user");
  const user = await loadSafeUser(record.userId);
  if (!user) return null;

  // Trace d'usage (best effort, non bloquant).
  db()
    .update(schema.mcpTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.mcpTokens.id, record.id))
    .catch(() => {});

  return user;
}

/** Liste des jetons d'un utilisateur (sans valeur en clair). */
export async function listMcpTokens(userId: string) {
  return db()
    .select({
      id: schema.mcpTokens.id,
      prefix: schema.mcpTokens.prefix,
      label: schema.mcpTokens.label,
      lastUsedAt: schema.mcpTokens.lastUsedAt,
      createdAt: schema.mcpTokens.createdAt,
    })
    .from(schema.mcpTokens)
    .where(eq(schema.mcpTokens.userId, userId))
    .orderBy(schema.mcpTokens.createdAt);
}

export async function revokeMcpToken(userId: string, tokenId: string) {
  await db()
    .delete(schema.mcpTokens)
    .where(
      and(
        eq(schema.mcpTokens.id, tokenId),
        eq(schema.mcpTokens.userId, userId),
      ),
    );
}

/** Le porteur d'un jeton (session web) — utilitaire de garde inutilisé côté MCP. */
export async function requireSessionUser(): Promise<SafeUser | null> {
  return sessionUser();
}
