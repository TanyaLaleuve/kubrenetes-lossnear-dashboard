"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteEgg } from "@/lib/servers/egg-actions";

export function EggDeleteButton({
  eggId,
  eggName,
}: {
  eggId: string;
  eggName: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          window.confirm(
            `Supprimer le template « ${eggName} » ? Les serveurs déjà créés ne sont pas affectés.`,
          )
        ) {
          start(async () => deleteEgg(eggId));
        }
      }}
      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive transition-colors duration-150 hover:bg-destructive hover:text-white disabled:opacity-50"
    >
      <Trash2 className="size-4" aria-hidden />
      {pending ? "…" : "Supprimer"}
    </button>
  );
}
