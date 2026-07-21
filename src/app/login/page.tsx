"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { login, type LoginState } from "@/lib/auth/actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="grid size-12 place-items-center rounded-2xl border border-border bg-card">
            <LockKeyhole className="size-5 text-accent" aria-hidden />
          </span>
          <h1 className="font-mono text-lg font-semibold">lossnear/k8s</h1>
          <p className="text-sm text-muted-foreground">
            Dashboard d&apos;administration du cluster
          </p>
        </div>

        <form
          action={formAction}
          className="space-y-4 rounded-xl border border-border bg-card p-5"
        >
          <div className="space-y-1.5">
            <label htmlFor="identifier" className="text-sm font-medium">
              Utilisateur ou email
            </label>
            <input
              id="identifier"
              name="identifier"
              autoComplete="username"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-accent"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-accent"
            />
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full cursor-pointer rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </main>
  );
}
