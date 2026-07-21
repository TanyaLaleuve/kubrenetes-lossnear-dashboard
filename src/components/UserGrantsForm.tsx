"use client";

import { useActionState } from "react";
import { updateUserGrants, type ServerFormState } from "@/lib/servers/actions";

const initialState: ServerFormState = {};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs outline-none transition-colors duration-150 focus:border-accent";

export function UserGrantsForm({
  user,
}: {
  user: {
    id: string;
    canCreateServers: boolean;
    quotaMaxServers: number;
    quotaMemoryMi: number;
    quotaCpuMilli: number;
    quotaDiskGi: number;
  };
}) {
  const [state, action, pending] = useActionState(updateUserGrants, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={user.id} />
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="canCreateServers"
          defaultChecked={user.canCreateServers}
          className="size-4 accent-(--accent)"
        />
        Peut créer des serveurs
      </label>
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
