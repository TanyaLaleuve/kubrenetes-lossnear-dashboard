import "server-only";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

export type SessionData = {
  userId?: string;
  loggedIn: boolean;
};

const defaultSession: SessionData = { loggedIn: false };

function sessionOptions(): SessionOptions {
  return {
    password: env().SESSION_SECRET,
    cookieName: "lossnear_k8s_session",
    ttl: 60 * 60 * 12, // 12 h
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  };
}

export async function getSession() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions(),
  );
  if (session.loggedIn === undefined) {
    Object.assign(session, defaultSession);
  }
  return session;
}

/** Garde des pages : redirige vers /login si non connecté. */
export async function requireSession(): Promise<SessionData & { userId: string }> {
  const session = await getSession();
  if (!session.loggedIn || !session.userId) {
    redirect("/login");
  }
  return session as SessionData & { userId: string };
}
