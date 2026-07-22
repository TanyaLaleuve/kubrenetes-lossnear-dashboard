"use client";

import { useActionState, useRef } from "react";
import { Upload } from "lucide-react";
import { importEgg, type EggFormState } from "@/lib/servers/egg-actions";

const initialState: EggFormState = {};

export function EggImportForm() {
  const [state, action, pending] = useActionState(importEgg, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !textareaRef.current) return;
    textareaRef.current.value = await file.text();
  }

  return (
    <form action={action} className="space-y-4" data-keep-empty>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground">
          <Upload className="size-3.5" aria-hidden />
          Charger un fichier .json
          <input
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="hidden"
          />
        </label>
        <span className="text-xs text-muted-foreground">
          ou colle le contenu ci-dessous
        </span>
      </div>

      <textarea
        ref={textareaRef}
        name="json"
        rows={14}
        required
        placeholder='{ "meta": { "version": "PTDL_v2" }, "name": "...", "startup": "...", "docker_images": { ... }, "variables": [ ... ] }'
        className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-xs outline-none transition-colors duration-150 focus:border-accent"
      />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 sm:w-auto sm:px-6"
      >
        {pending ? "Import…" : "Importer l'egg"}
      </button>
    </form>
  );
}
