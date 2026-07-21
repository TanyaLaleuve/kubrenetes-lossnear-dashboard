"use client";

import { useActionState } from "react";
import { transferServer, type ServerFormState } from "@/lib/servers/actions";

const initialState: ServerFormState = {};

export function ServerOwner({
  serverId,
  ownerId,
  ownerName,
  users,
}: {
  serverId: string;
  ownerId: string;
  ownerName: string;
  users: { id: string; username: string }[];
}) {
  const [state, action, pending] = useActionState(transferServer, initialState);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Propriétaire
      </p>
      <form action={action} className="mt-1.5 flex items-center gap-2">
        <input type="hidden" name="serverId" value={serverId} />
        <select
          name="newOwnerId"
          defaultValue={ownerId}
          aria-label="Propriétaire du serveur"
          className="min-w-0 flex-1 cursor-pointer rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-sm outline-none transition-colors duration-150 focus:border-accent"
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username}
              {user.id === ownerId ? " (actuel)" : ""}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground disabled:opacity-50"
        >
          {pending ? "…" : "Transférer"}
        </button>
      </form>
      {state.error ? (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {state.error}
        </p>
      ) : (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Actuel : {ownerName}. Transférer donne le contrôle total à l&apos;autre
          compte.
        </p>
      )}
    </div>
  );
}
