"use client";

import { useActionState } from "react";
import { updateUserPermissions, type AdminFormState } from "@/lib/admin/actions";
import { DASHBOARD_PERMISSION_GROUPS } from "@/lib/auth/dashboard-permissions";

const initialState: AdminFormState = {};

export function UserPermissionsForm({
  userId,
  permissions,
  isAdmin,
}: {
  userId: string;
  permissions: string[];
  isAdmin: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateUserPermissions,
    initialState,
  );
  const granted = new Set(permissions);

  if (isAdmin) {
    return (
      <p className="text-xs text-muted-foreground">
        Administrateur : accès à toutes les sections d&apos;office.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-3 sm:grid-cols-2">
        {DASHBOARD_PERMISSION_GROUPS.map((group) => (
          <fieldset key={group.key} className="space-y-1.5">
            <legend className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </legend>
            {group.perms.map((perm) => (
              <label
                key={perm.key}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="perm"
                  value={perm.key}
                  defaultChecked={granted.has(perm.key)}
                  className="size-4 accent-(--accent)"
                />
                {perm.label}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground disabled:opacity-50"
        >
          {pending ? "…" : "Enregistrer les accès"}
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
