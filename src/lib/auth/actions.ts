"use server";

import { compare } from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db, schema } from "@/lib/db";
import { getSession } from "./session";

// Anti brute-force en mémoire : suffisant pour un déploiement mono-replica
// (le dashboard admin n'est pas autoscalé). À remplacer par Redis si réplication.
const attempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
}

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const ip = await clientIp();
  const entry = attempts.get(ip);
  if (entry && entry.lockedUntil > Date.now()) {
    return { error: "Trop de tentatives. Réessaie dans 15 minutes." };
  }

  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const rows = await db()
    .select()
    .from(schema.users)
    .where(
      or(eq(schema.users.username, identifier), eq(schema.users.email, identifier)),
    )
    .limit(1);
  const user = rows[0];

  // Cascade de comptes : seuls les comptes d'origine "k8s" (niveau parent)
  // peuvent se connecter à ce dashboard.
  const allowed = user !== undefined && user.origin === "k8s";
  const passwordOk =
    allowed && (await compare(password, user.passwordHash));

  if (!passwordOk) {
    const count = (entry?.count ?? 0) + 1;
    attempts.set(ip, {
      count,
      lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0,
    });
    return { error: "Identifiants invalides." };
  }

  attempts.delete(ip);
  const session = await getSession();
  session.userId = user.id;
  session.loggedIn = true;
  await session.save();
  redirect("/");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
