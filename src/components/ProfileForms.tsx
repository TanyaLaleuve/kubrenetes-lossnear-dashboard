"use client";

import { useActionState } from "react";
import {
  updateEmail,
  updatePassword,
  updateUsername,
  type ProfileFormState,
} from "@/lib/profile/actions";

const initialState: ProfileFormState = {};

function Feedback({ state }: { state: ProfileFormState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return <p className="text-sm text-accent">{state.success}</p>;
  }
  return null;
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none transition-colors duration-150 focus:border-accent";
const submitClass =
  "cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground disabled:opacity-50";

export function UsernameForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState(updateUsername, initialState);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="username" className="text-sm font-medium">
          Nom d&apos;utilisateur
        </label>
        <input
          id="username"
          name="username"
          defaultValue={username}
          required
          minLength={3}
          maxLength={32}
          className={inputClass}
        />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "…" : "Mettre à jour"}
      </button>
    </form>
  );
}

export function EmailForm({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState(updateEmail, initialState);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={email ?? ""}
          placeholder="tanya@lossnear.com"
          required
          data-keep-empty
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">
          Servira à la récupération de compte (envoi de mails à venir).
        </p>
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "…" : "Mettre à jour"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="currentPassword" className="text-sm font-medium">
          Mot de passe actuel
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="newPassword" className="text-sm font-medium">
          Nouveau mot de passe
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground">12 caractères minimum.</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirmer le nouveau mot de passe
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={submitClass}>
        {pending ? "…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
