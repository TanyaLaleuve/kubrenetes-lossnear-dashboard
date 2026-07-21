"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  File as FileIcon,
  Folder,
  FolderPlus,
  Pencil,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type Entry = { name: string; dir: boolean; size: number; mtime: number };

function formatSize(bytes: number): string {
  if (bytes >= 1 << 20) return `${(bytes / (1 << 20)).toFixed(1)} Mio`;
  if (bytes >= 1 << 10) return `${(bytes / (1 << 10)).toFixed(0)} Kio`;
  return `${bytes} o`;
}

export function FileManager({ serverId }: { serverId: string }) {
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ name: string; content: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const base = `/api/servers/${serverId}/files`;
  const join = (p: string, name: string) => (p ? `${p}/${name}` : name);

  const load = useCallback(async () => {
    // Micro-défer : évite un setState synchrone dans l'effet.
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}?path=${encodeURIComponent(path)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
      setEntries(body.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [base, path]);

  useEffect(() => {
    // Chargement asynchrone : les setState surviennent après un await, donc
    // hors du rendu synchrone de l'effet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function up() {
    setPath((p) => p.split("/").slice(0, -1).join("/"));
  }

  async function openFile(name: string) {
    const filePath = join(path, name);
    try {
      const res = await fetch(
        `${base}?raw=1&path=${encodeURIComponent(filePath)}`,
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Lecture impossible");
      setEditing({ name: filePath, content: await res.text() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function saveFile() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${base}?op=write&path=${encodeURIComponent(editing.name)}`,
        { method: "POST", body: editing.content },
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Écriture impossible");
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function op(
    operation: "mkdir" | "delete" | "rename",
    target: string,
    to?: string,
  ) {
    try {
      const res = await fetch(
        `${base}?op=${operation}&path=${encodeURIComponent(target)}`,
        operation === "rename"
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ to }),
            }
          : { method: "POST" },
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Action impossible");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function upload(files: FileList) {
    setError(null);
    for (const file of Array.from(files)) {
      const dest = join(path, file.name);
      const res = await fetch(
        `${base}?op=upload&path=${encodeURIComponent(dest)}`,
        { method: "POST", body: file },
      );
      if (!res.ok) {
        setError(`Échec de l'envoi de ${file.name}`);
        break;
      }
    }
    if (uploadRef.current) uploadRef.current.value = "";
    load();
  }

  const crumbs = path ? path.split("/") : [];

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground hover:bg-card-hover"
            aria-label="Fermer l'éditeur"
          >
            <X className="size-4" aria-hidden />
          </button>
          <p className="min-w-0 flex-1 truncate font-mono text-sm">{editing.name}</p>
          <button
            type="button"
            onClick={saveFile}
            disabled={saving}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Save className="size-4" aria-hidden />
            {saving ? "…" : "Enregistrer"}
          </button>
        </div>
        <textarea
          value={editing.content}
          onChange={(e) => setEditing({ ...editing, content: e.target.value })}
          spellCheck={false}
          className="h-[60vh] w-full resize-none rounded-xl border border-border bg-[#04070f] p-3 font-mono text-xs outline-none focus:border-accent"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={up}
          disabled={!path}
          className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground hover:bg-card-hover disabled:opacity-40"
          aria-label="Dossier parent"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <nav className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setPath("")}
            className="cursor-pointer hover:text-foreground"
          >
            /data
          </button>
          {crumbs.map((c, i) => (
            <span key={i}>
              {" / "}
              <button
                type="button"
                onClick={() => setPath(crumbs.slice(0, i + 1).join("/"))}
                className="cursor-pointer hover:text-foreground"
              >
                {c}
              </button>
            </span>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => {
            const name = prompt("Nom du dossier :");
            if (name) op("mkdir", join(path, name));
          }}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs text-muted-foreground hover:bg-card-hover hover:text-foreground"
        >
          <FolderPlus className="size-3.5" aria-hidden />
          Dossier
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs text-muted-foreground hover:bg-card-hover hover:text-foreground">
          <Upload className="size-3.5" aria-hidden />
          Envoyer
          <input
            ref={uploadRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => e.target.files && upload(e.target.files)}
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
        ) : entries.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Dossier vide.</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => {
              const full = join(path, entry.name);
              const editable = !entry.dir && (entry.size < 2_000_000);
              return (
                <li key={entry.name} className="flex items-center gap-2 p-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      entry.dir ? setPath(full) : editable && openFile(entry.name)
                    }
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                  >
                    {entry.dir ? (
                      <Folder className="size-4 shrink-0 text-info" aria-hidden />
                    ) : (
                      <FileIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    )}
                    <span className="truncate font-mono text-sm">{entry.name}</span>
                    {!entry.dir && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatSize(entry.size)}
                      </span>
                    )}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {!entry.dir && (
                      <a
                        href={`${base}?download=1&path=${encodeURIComponent(full)}`}
                        className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-card-hover hover:text-foreground"
                        aria-label={`Télécharger ${entry.name}`}
                      >
                        <Download className="size-3.5" aria-hidden />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const to = prompt("Renommer en :", entry.name);
                        if (to && to !== entry.name) op("rename", full, join(path, to));
                      }}
                      className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-card-hover hover:text-foreground"
                      aria-label={`Renommer ${entry.name}`}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Supprimer ${entry.name} ?`)) op("delete", full);
                      }}
                      className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-card-hover hover:text-destructive"
                      aria-label={`Supprimer ${entry.name}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
