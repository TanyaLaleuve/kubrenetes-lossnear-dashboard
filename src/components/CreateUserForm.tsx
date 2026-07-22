"use client";

import { useActionState, useRef, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { createUser, type AdminFormState } from "@/lib/admin/actions";

const initialState: AdminFormState = {};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent";
const numClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none transition-colors duration-150 focus:border-accent";

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUser, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Réinitialise le formulaire après une création réussie.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form
      ref={formRef}
      action={action}
      data-keep-empty
      className="space-y-4 rounded-xl border border-border bg-card p-5"
    >
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <UserPlus className="size-4 text-accent" aria-hidden />
          Créer un compte
        </h2>
        <p className="text-xs text-muted-foreground">
          Le compte pourra se connecter au dashboard et changer son mot de passe.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="cu-username" className="text-xs font-medium text-muted-foreground">
            Nom d&apos;utilisateur
          </label>
          <input id="cu-username" name="username" required className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cu-email" className="text-xs font-medium text-muted-foreground">
            Email (optionnel)
          </label>
          <input id="cu-email" name="email" type="email" data-keep-empty className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="cu-password" className="text-xs font-medium text-muted-foreground">
            Mot de passe (12+)
          </label>
          <input
            id="cu-password"
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="canCreateServers" defaultChecked className="size-4 accent-(--accent)" />
          Peut créer des serveurs
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" name="isAdmin" className="size-4 accent-(--accent)" />
          Administrateur
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="space-y-1 text-xs text-muted-foreground">
          Serveurs max
          <input name="quotaMaxServers" type="number" min={0} max={100} defaultValue={1} className={numClass} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          RAM (Mio)
          <input name="quotaMemoryMi" type="number" min={0} max={262144} defaultValue={4096} className={numClass} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          CPU (milli)
          <input name="quotaCpuMilli" type="number" min={0} max={64000} defaultValue={2000} className={numClass} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Disque (Gio)
          <input name="quotaDiskGi" type="number" min={0} max={2000} defaultValue={10} className={numClass} />
        </label>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && <p className="text-sm text-accent">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
      >
        <UserPlus className="size-4" aria-hidden />
        {pending ? "Création…" : "Créer le compte"}
      </button>
    </form>
  );
}
