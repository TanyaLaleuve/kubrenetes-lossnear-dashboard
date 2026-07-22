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
    isAdmin: boolean;
    canCreateServers: boolean;
    quotaMaxServers: number;
    quotaMemoryMi: number;
    quotaCpuMilli: number;
    quotaDiskGi: number;
    portRangeStart: number | null;
    portRangeEnd: number | null;
  };
}) {
  const [state, action, pending] = useActionState(updateUserGrants, initialState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={user.id} />
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="canCreateServers"
            defaultChecked={user.canCreateServers}
            className="size-4 accent-(--accent)"
          />
          Peut créer des serveurs
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isAdmin"
            defaultChecked={user.isAdmin}
            className="size-4 accent-(--accent)"
          />
          Administrateur
        </label>
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="space-y-1 text-xs text-muted-foreground">
          Port ext. min
          <input
            name="portRangeStart"
            type="number"
            min={25600}
            max={25699}
            placeholder="auto"
            defaultValue={user.portRangeStart ?? ""}
            className={inputClass}
          />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Port ext. max
          <input
            name="portRangeEnd"
            type="number"
            min={25600}
            max={25699}
            placeholder="auto"
            defaultValue={user.portRangeEnd ?? ""}
            className={inputClass}
          />
        </label>
        <p className="col-span-2 self-center text-[11px] text-muted-foreground">
          Plage de ports allouée (25600-25699). Vide = plage globale.
        </p>
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
