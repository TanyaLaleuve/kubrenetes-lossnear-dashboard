"use client";

import { useActionState, useTransition } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import {
  addMember,
  removeMember,
  updateMemberPermissions,
  type ServerFormState,
} from "@/lib/servers/actions";
import { PERMISSION_GROUPS } from "@/lib/servers/permissions";

const initialState: ServerFormState = {};

type Member = {
  userId: string;
  username: string;
  hasAvatar: boolean;
  permissions: string[];
};

function InviteForm({ serverId }: { serverId: string }) {
  const [state, action, pending] = useActionState(addMember, initialState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="serverId" value={serverId} />
      <div className="min-w-0 flex-1">
        <label htmlFor="invite" className="text-xs text-muted-foreground">
          Inviter par nom d&apos;utilisateur
        </label>
        <input
          id="invite"
          name="username"
          required
          placeholder="pseudo"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-accent"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
      >
        <UserPlus className="size-4" aria-hidden />
        {pending ? "…" : "Inviter"}
      </button>
      {state.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

function MemberCard({
  serverId,
  member,
}: {
  serverId: string;
  member: Member;
}) {
  const [state, action, pending] = useActionState(
    updateMemberPermissions,
    initialState,
  );
  const [removing, startRemove] = useTransition();
  const granted = new Set(member.permissions);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Avatar
          userId={member.userId}
          username={member.username}
          hasAvatar={member.hasAvatar}
          size={36}
        />
        <p className="min-w-0 flex-1 truncate font-mono text-sm font-semibold">
          {member.username}
        </p>
        <button
          type="button"
          onClick={() =>
            startRemove(async () => removeMember(serverId, member.userId))
          }
          disabled={removing}
          aria-label={`Retirer ${member.username}`}
          className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>

      <form action={action} className="mt-3">
        <input type="hidden" name="serverId" value={serverId} />
        <input type="hidden" name="memberId" value={member.userId} />
        <div className="grid gap-3 sm:grid-cols-2">
          {PERMISSION_GROUPS.map((group) => (
            <fieldset key={group.key} className="space-y-1.5">
              <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground disabled:opacity-50"
          >
            {pending ? "…" : "Enregistrer les permissions"}
          </button>
          {state.error && (
            <span role="alert" className="text-xs text-destructive">
              {state.error}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

export function MemberManager({
  serverId,
  members,
  canManage,
}: {
  serverId: string;
  members: Member[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      {canManage && <InviteForm serverId={serverId} />}

      {members.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Aucun membre invité. Le propriétaire a déjà tous les droits.
        </p>
      ) : canManage ? (
        members.map((member) => (
          <MemberCard key={member.userId} serverId={serverId} member={member} />
        ))
      ) : (
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <Avatar
                userId={member.userId}
                username={member.username}
                hasAvatar={member.hasAvatar}
                size={28}
              />
              <span className="font-mono text-sm">{member.username}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {member.permissions.length} permission
                {member.permissions.length > 1 ? "s" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
