"use client";

import { useActionState } from "react";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { updateUserGrants, type ServerFormState } from "@/lib/servers/actions";

const initialState: ServerFormState = {};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none transition-colors duration-150 focus:border-accent";

export function UserGrantsForm({
  user,
}: {
  user: {
    id: string;
    isAdmin: boolean;
    canCreateServers: boolean;
    quotaMaxServers: number;
    quotaMemoryMi: number;
    quotaCpuMilli: number;
    quotaDiskGi: number;
    portAllowlist: string | null;
  };
}) {
  const [state, action, pending] = useActionState(updateUserGrants, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={user.id} />
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <ToggleSwitch
          name="canCreateServers"
          defaultChecked={user.canCreateServers}
          label="Peut créer des serveurs"
        />
        <ToggleSwitch
          name="isAdmin"
          defaultChecked={user.isAdmin}
          label="Administrateur"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="space-y-1 text-xs text-muted-foreground">
          Serveurs max
          <input
            name="quotaMaxServers"
            type="number"
            min={0}
            max={100}
            defaultValue={user.quotaMaxServers}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          RAM (Mio)
          <input
            name="quotaMemoryMi"
            type="number"
            min={0}
            max={262144}
            defaultValue={user.quotaMemoryMi}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          CPU (milli)
          <input
            name="quotaCpuMilli"
            type="number"
            min={0}
            max={64000}
            defaultValue={user.quotaCpuMilli}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Disque (Gio)
          <input
            name="quotaDiskGi"
            type="number"
            min={0}
            max={2000}
            defaultValue={user.quotaDiskGi}
            className={inputClass}
          />
        </label>
      </div>
      <label className="block space-y-1 text-xs text-muted-foreground">
        Ports externes autorisés
        <input
          name="portAllowlist"
          type="text"
          data-keep-empty
          placeholder="ex. 25601, 25605, 25610-25615"
          defaultValue={user.portAllowlist ?? ""}
          className={`${inputClass} font-mono`}
        />
        <span className="block text-[11px] text-muted-foreground">
          Ports et plages séparés par des virgules (25600-25699). Vide = plage
          globale complète.
        </span>
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground disabled:opacity-50"
      >
        {pending ? "…" : "Enregistrer"}
      </button>
    </form>
  );
}
