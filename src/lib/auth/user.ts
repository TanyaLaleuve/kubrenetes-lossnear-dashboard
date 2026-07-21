import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { getSession } from "./session";

export type SafeUser = {
  id: string;
  username: string;
  email: string | null;
  origin: "k8s" | "minecraft" | "bot";
  hasAvatar: boolean;
  discordId: string | null;
  isAdmin: boolean;
  canCreateServers: boolean;
  quotaMaxServers: number;
  quotaMemoryMi: number;
  quotaCpuMilli: number;
  quotaDiskGi: number;
  /** Epoch ms de la dernière modification — sert de cache-buster avatar. */
  updatedAt: number;
};

/** Utilisateur connecté ou null (usage API routes). */
export async function sessionUser(): Promise<SafeUser | null> {
  const session = await getSession();
  if (!session.loggedIn || !session.userId) return null;

  const rows = await db()
    .select({
      id: schema.users.id,
      username: schema.users.username,
      email: schema.users.email,
      origin: schema.users.origin,
      avatar: schema.users.avatar,
      discordId: schema.users.discordId,
      isAdmin: schema.users.isAdmin,
      canCreateServers: schema.users.canCreateServers,
      quotaMaxServers: schema.users.quotaMaxServers,
      quotaMemoryMi: schema.users.quotaMemoryMi,
      quotaCpuMilli: schema.users.quotaCpuMilli,
      quotaDiskGi: schema.users.quotaDiskGi,
      updatedAt: schema.users.updatedAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  const user = rows[0];
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    origin: user.origin,
    hasAvatar: user.avatar !== null,
    discordId: user.discordId,
    isAdmin: user.isAdmin,
    canCreateServers: user.canCreateServers,
    quotaMaxServers: user.quotaMaxServers,
    quotaMemoryMi: user.quotaMemoryMi,
    quotaCpuMilli: user.quotaCpuMilli,
    quotaDiskGi: user.quotaDiskGi,
    updatedAt: user.updatedAt.valueOf(),
  };
}

/** Utilisateur connecté (pages). Redirige vers /login si session invalide. */
export async function currentUser(): Promise<SafeUser> {
  const user = await sessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
