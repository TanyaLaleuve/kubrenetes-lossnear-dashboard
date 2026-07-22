"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound } from "lucide-react";
import { adminSetPassword, type AdminFormState } from "@/lib/admin/actions";

const initialState: AdminFormState = {};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent";

export function AdminPasswordForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(adminSetPassword, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={action} data-keep-empty className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <p className="text-xs text-muted-foreground">
        Définis un nouveau mot de passe et communique-le à la personne. Tu ne
        peux pas voir l&apos;ancien (stocké haché).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="admin-newpw" className="text-xs text-muted-foreground">
            Nouveau mot de passe (12+)
          </label>
          <input
            id="admin-newpw"
            name="newPassword"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            className={`mt-1 ${inputClass}`}
          />
        </div>
        <div>
          <label htmlFor="admin-confirmpw" className="text-xs text-muted-foreground">
            Confirmer
          </label>
          <input
            id="admin-confirmpw"
            name="confirmPassword"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            className={`mt-1 ${inputClass}`}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground disabled:opacity-50"
        >
          <KeyRound className="size-3.5" aria-hidden />
          {pending ? "…" : "Réinitialiser le mot de passe"}
        </button>
        {state.error && (
          <span role="alert" className="text-xs text-destructive">
            {state.error}
          </span>
        )}
        {state.success && (
          <span className="text-xs text-accent">{state.success}</span>
        )}
      </div>
    </form>
  );
}
