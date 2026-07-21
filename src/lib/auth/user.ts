import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { requireSession } from "./session";

export type SafeUser = {
  id: string;
  username: string;
  email: string | null;
  origin: "k8s" | "minecraft" | "bot";
  hasAvatar: boolean;
  discordId: string | null;
  /** Epoch ms de la dernière modification — sert de cache-buster avatar. */
  updatedAt: number;
};

/** Utilisateur connecté (sans données sensibles). Redirige si session orpheline. */
export async function currentUser(): Promise<SafeUser> {
  const session = await requireSession();
  const rows = await db()
    .select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      origin: schema.users.origin,
      avatar: schema.users.avatar,
      discordId: schema.users.discordId,
      updatedAt: schema.users.updatedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  const user = rows[0];
  if (!user) {
    redirect("/login");
  }
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    origin: user.origin,
    hasAvatar: user.avatar !== null,
    discordId: user.discordId,
    updatedAt: user.updatedAt.valueOf(),
  };
}
