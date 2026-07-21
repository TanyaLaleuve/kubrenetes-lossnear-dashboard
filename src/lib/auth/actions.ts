"use server";

import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { env } from "@/lib/env";
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

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  const userOk = username === env().ADMIN_USER;
  const passwordOk = await compare(password, env().ADMIN_PASSWORD_HASH);

  if (!userOk || !passwordOk) {
    const count = (entry?.count ?? 0) + 1;
    attempts.set(ip, {
      count,
      lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0,
    });
    return { error: "Identifiants invalides." };
  }

  attempts.delete(ip);
  const session = await getSession();
  session.username = username;
  session.loggedIn = true;
  await session.save();
  redirect("/");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
