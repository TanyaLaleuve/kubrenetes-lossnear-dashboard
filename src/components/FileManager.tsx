"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  File as FileIcon,
  FileArchive,
  Folder,
  FolderPlus,
  Pencil,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

type Entry = {
  name: string;
  dir: boolean;
  size: number;
  mtime: number;
  ctime: number;
};

function formatSize(bytes: number): string {
  if (bytes >= 1 << 20) return `${(bytes / (1 << 20)).toFixed(1)} Mio`;
  if (bytes >= 1 << 10) return `${(bytes / (1 << 10)).toFixed(0)} Kio`;
  return `${bytes} o`;
}

/** Date relative si < 24 h (« il y a … »), sinon date absolue. */
function formatWhen(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 0) return new Date(ms).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(ms).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

const ARCHIVE_RE = /\.(zip|tar\.gz|tgz|tar|gz)$/i;

function filesFromDrop(dataTransfer: DataTransfer): {
  files: File[];
  rejectedDirs: number;
} {
  const files: File[] = [];
  let rejectedDirs = 0;
  if (dataTransfer.items) {
    for (const item of Array.from(dataTransfer.items)) {
      if (item.kind !== "file") continue;
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        rejectedDirs++;
        continue;
      }
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  } else {
    files.push(...Array.from(dataTransfer.files));
  }
  return { files, rejectedDirs };
}

export function FileManager({
  serverId,
  canWrite,
  canDelete,
}: {
  serverId: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ name: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);
  const dragCounter = useRef(0);
  const uploadRef = useRef<HTMLInputElement>(null);

  const base = `/api/servers/${serverId}/files`;
  const join = (p: string, name: string) => (p ? `${p}/${name}` : name);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    setSelected(new Set());
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function up() {
    setPath((p) => p.split("/").slice(0, -1).join("/"));
  }

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }
  const allSelected = entries.length > 0 && selected.size === entries.length;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.name)));
  }

  async function openFile(name: string) {
    const filePath = join(path, name);
    try {
      const res = await fetch(`${base}?raw=1&path=${encodeURIComponent(filePath)}`);
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
      const res = await fetch(`${base}?op=write&path=${encodeURIComponent(editing.name)}`, {
        method: "POST",
        body: editing.content,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Écriture impossible");
      setEditing(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  async function op(operation: "mkdir" | "delete" | "rename", target: string, to?: string) {
    try {
      const res = await fetch(
        `${base}?op=${operation}&path=${encodeURIComponent(target)}`,
        operation === "rename"
          ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to }) }
          : { method: "POST" },
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Action impossible");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function upload(files: File[] | FileList) {
    setError(null);
    for (const file of Array.from(files)) {
      const dest = join(path, file.name);
      const res = await fetch(`${base}?op=upload&path=${encodeURIComponent(dest)}`, {
        method: "POST",
        body: file,
      });
      if (!res.ok) {
        setError(`Échec de l'envoi de ${file.name}`);
        break;
      }
    }
    if (uploadRef.current) uploadRef.current.value = "";
    load();
  }

  // ---- Actions groupées sur la sélection ----
  const selectedPaths = useMemo(
    () => [...selected].map((name) => join(path, name)),
    [selected, path],
  );

  async function extract(name: string) {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`${base}?op=extract&path=${encodeURIComponent(join(path, name))}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dest: path }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Extraction impossible");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setWorking(false);
    }
  }

  async function compressSelection() {
    const suggestion = selected.size === 1 ? `${[...selected][0]}.tar.gz` : "archive.tar.gz";
    const name = prompt("Nom de l'archive (.tar.gz ou .zip) :", suggestion);
    if (!name) return;
    const format = /\.zip$/i.test(name) ? "zip" : "targz";
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`${base}?op=compress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: selectedPaths, dest: join(path, name), format }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Compression impossible");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setWorking(false);
    }
  }

  async function downloadSelection() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`${base}?op=archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: selectedPaths }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Téléchargement impossible");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "selection.tar.gz";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setWorking(false);
    }
  }

  async function deleteSelection() {
    if (!confirm(`Supprimer ${selected.size} élément(s) ?`)) return;
    setWorking(true);
    setError(null);
    try {
      for (const name of selected) {
        const res = await fetch(`${base}?op=delete&path=${encodeURIComponent(join(path, name))}`, {
          method: "POST",
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Suppression impossible");
      }
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      load();
    } finally {
      setWorking(false);
    }
  }

  // ---- Drag & drop upload ----
  function onDragEnter(e: React.DragEvent) {
    if (!canWrite) return;
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  }
  function onDragOver(e: React.DragEvent) {
    if (!canWrite) return;
    e.preventDefault();
  }
  function onDragLeave(e: React.DragEvent) {
    if (!canWrite) return;
    e.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) setDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    if (!canWrite) return;
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const { files, rejectedDirs } = filesFromDrop(e.dataTransfer);
    if (rejectedDirs > 0) {
      setError(
        rejectedDirs === 1
          ? "Un dossier a été ignoré : compresse-le puis envoie-le via « Envoyer »."
          : `${rejectedDirs} dossiers ont été ignorés : compresse-les puis envoie-les.`,
      );
    }
    if (files.length > 0) upload(files);
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
          {canWrite && (
            <button
              type="button"
              onClick={saveFile}
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Save className="size-4" aria-hidden />
              {saving ? "…" : "Enregistrer"}
            </button>
          )}
        </div>
        <textarea
          value={editing.content}
          onChange={(e) => setEditing({ ...editing, content: e.target.value })}
          readOnly={!canWrite}
          spellCheck={false}
          className="h-[60vh] w-full resize-none rounded-xl border border-border bg-[#04070f] p-3 font-mono text-xs outline-none focus:border-accent read-only:opacity-70"
        />
      </div>
    );
  }

  return (
    <div
      className="relative space-y-3"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl border-2 border-dashed border-accent bg-accent/10 backdrop-blur-sm">
          <p className="flex items-center gap-2 rounded-lg bg-background px-4 py-2 text-sm font-medium text-accent shadow">
            <Upload className="size-4" aria-hidden />
            Dépose tes fichiers ici
          </p>
        </div>
      )}

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
          <button type="button" onClick={() => setPath("")} className="cursor-pointer hover:text-foreground">
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
        {canWrite && (
          <>
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
          </>
        )}
      </div>

      {/* Barre d'actions sur la sélection */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 p-2.5">
          <span className="text-xs font-medium text-accent">{selected.size} sélectionné(s)</span>
          <button
            type="button"
            onClick={downloadSelection}
            disabled={working}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <Download className="size-3.5" aria-hidden />
            Télécharger
          </button>
          {canWrite && (
            <button
              type="button"
              onClick={compressSelection}
              disabled={working}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <FileArchive className="size-3.5" aria-hidden />
              Compresser
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={deleteSelection}
              disabled={working}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Supprimer
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          >
            Annuler
          </button>
        </div>
      )}

      {canWrite && selected.size === 0 && (
        <p className="text-xs text-muted-foreground">
          Glisse-dépose des fichiers dans la liste. Coche des éléments pour les
          compresser, télécharger ou supprimer ensemble.
        </p>
      )}

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
          <>
            <div className="flex items-center gap-2 border-b border-border px-2.5 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Tout sélectionner"
                className="size-4 accent-(--accent)"
              />
              <span className="flex-1">Nom</span>
              <span className="hidden w-28 shrink-0 sm:block">Ajouté</span>
              <span className="hidden w-28 shrink-0 sm:block">Modifié</span>
              <span className="w-24 shrink-0" />
            </div>
            <ul className="divide-y divide-border">
              {entries.map((entry) => {
                const full = join(path, entry.name);
                const editable = !entry.dir && entry.size < 2_000_000;
                const isArchive = !entry.dir && ARCHIVE_RE.test(entry.name);
                const checked = selected.has(entry.name);
                return (
                  <li
                    key={entry.name}
                    className={`flex items-center gap-2 p-2.5 ${checked ? "bg-accent/5" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(entry.name)}
                      aria-label={`Sélectionner ${entry.name}`}
                      className="size-4 shrink-0 accent-(--accent)"
                    />
                    <button
                      type="button"
                      onClick={() => (entry.dir ? setPath(full) : editable && openFile(entry.name))}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
                    >
                      {entry.dir ? (
                        <Folder className="size-4 shrink-0 text-info" aria-hidden />
                      ) : isArchive ? (
                        <FileArchive className="size-4 shrink-0 text-warning" aria-hidden />
                      ) : (
                        <FileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      <span className="truncate font-mono text-sm">{entry.name}</span>
                      {!entry.dir && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatSize(entry.size)}
                        </span>
                      )}
                    </button>
                    <span className="hidden w-28 shrink-0 text-xs text-muted-foreground sm:block">
                      {formatWhen(entry.ctime)}
                    </span>
                    <span className="hidden w-28 shrink-0 text-xs text-muted-foreground sm:block">
                      {formatWhen(entry.mtime)}
                    </span>
                    <div className="flex w-24 shrink-0 items-center justify-end gap-1">
                      {isArchive && canWrite && (
                        <button
                          type="button"
                          onClick={() => extract(entry.name)}
                          disabled={working}
                          className="grid size-8 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-card-hover hover:text-foreground disabled:opacity-50"
                          aria-label={`Extraire ${entry.name}`}
                          title="Extraire ici"
                        >
                          <FileArchive className="size-3.5" aria-hidden />
                        </button>
                      )}
                      {!entry.dir && (
                        <a
                          href={`${base}?download=1&path=${encodeURIComponent(full)}`}
                          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-card-hover hover:text-foreground"
                          aria-label={`Télécharger ${entry.name}`}
                        >
                          <Download className="size-3.5" aria-hidden />
                        </a>
                      )}
                      {canWrite && (
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
                      )}
                      {canDelete && (
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
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
