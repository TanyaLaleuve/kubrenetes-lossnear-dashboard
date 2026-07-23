"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Eye,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  Variable,
  X,
} from "lucide-react";
import { DiscordMessagePreview } from "@/components/message-builder/DiscordMessagePreview";
import {
  CONTENT_LIMIT,
  DEFAULT_VARIABLES,
  EMBED_LIMIT,
  FIELD_LIMIT,
  emptyEmbed,
  type EmbedData,
  type MessagePayload,
  type MessageVariable,
} from "@/lib/messages/payload";

const input =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none transition-colors duration-150 focus:border-accent";

type Tab = "editor" | "variables" | "preview";

type SetValue = (v: string) => void;

export function MessageBuilder({
  value,
  onChange,
  name,
  variables = DEFAULT_VARIABLES,
  botName,
  botAvatar,
}: {
  value: MessagePayload;
  onChange: (next: MessagePayload) => void;
  /** Si fourni : un input caché contient le JSON du payload (soumission form). */
  name?: string;
  variables?: MessageVariable[];
  botName?: string;
  botAvatar?: string;
}) {
  const [tab, setTab] = useState<Tab>("editor");
  const active = useRef<{
    el: HTMLInputElement | HTMLTextAreaElement;
    set: SetValue;
  } | null>(null);

  // --- Mises à jour du payload ---
  const setContent = (content: string) => onChange({ ...value, content });
  const patchEmbed = (i: number, patch: Partial<EmbedData>) =>
    onChange({
      ...value,
      embeds: value.embeds.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    });
  const addEmbed = () =>
    value.embeds.length < EMBED_LIMIT &&
    onChange({ ...value, embeds: [...value.embeds, emptyEmbed()] });
  const removeEmbed = (i: number) =>
    onChange({ ...value, embeds: value.embeds.filter((_, idx) => idx !== i) });

  // Props communs à tous les champs texte (suivi du champ actif pour l'insertion
  // de variables au curseur).
  const bind = (v: string, set: SetValue) => ({
    value: v,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(e.target.value),
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Assignation dans un gestionnaire d'événement (pas au render) : sûr.
      // eslint-disable-next-line react-hooks/refs
      active.current = { el: e.currentTarget, set };
    },
  });

  function insertVariable(key: string) {
    const token = `{${key}}`;
    const a = active.current;
    if (!a) {
      setContent(`${value.content}${token}`);
      return;
    }
    const el = a.el;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    a.set(el.value.slice(0, start) + token + el.value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const p = start + token.length;
      el.setSelectionRange(p, p);
    });
    setTab("editor");
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {name && <input type="hidden" name={name} value={JSON.stringify(value)} />}

      <nav className="flex border-b border-border">
        {(
          [
            ["editor", "Éditeur", Pencil],
            ["variables", "Variables", Variable],
            ["preview", "Aperçu", Eye],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              tab === key
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:bg-card-hover hover:text-foreground"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      {tab === "editor" && (
        <div className="grid lg:grid-cols-[1fr_minmax(300px,400px)]">
          <div className="space-y-2.5 p-3">
            {/* Contenu */}
            <div className="space-y-1">
              <label className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Contenu du message</span>
                <span>
                  {value.content.length}/{CONTENT_LIMIT}
                </span>
              </label>
              <textarea
                rows={2}
                maxLength={CONTENT_LIMIT}
                placeholder="Texte du message (hors embed)…"
                className={input}
                {...bind(value.content, setContent)}
              />
            </div>

            {value.embeds.map((embed, i) => (
              <EmbedEditor
                key={i}
                index={i}
                embed={embed}
                bind={bind}
                patch={(p) => patchEmbed(i, p)}
                remove={() => removeEmbed(i)}
              />
            ))}

            {value.embeds.length < EMBED_LIMIT && (
              <button
                type="button"
                onClick={addEmbed}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
              >
                <Plus className="size-4" aria-hidden />
                Ajouter un embed
              </button>
            )}
          </div>

          {/* Aperçu attaché (desktop) — séparé par un trait. */}
          <div className="hidden border-l border-border bg-background/40 lg:block">
            <div className="sticky top-0 space-y-1.5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Eye className="size-3.5" aria-hidden />
                Aperçu en direct
              </p>
              <DiscordMessagePreview
                payload={value}
                variables={variables}
                botName={botName}
                botAvatar={botAvatar}
              />
            </div>
          </div>
        </div>
      )}

      {tab === "variables" && (
        <div className="space-y-2 p-3">
          <p className="text-xs text-muted-foreground">
            Clique une variable pour l&apos;insérer dans le dernier champ édité
            (sinon dans le contenu). Elle sera remplacée par sa vraie valeur à
            l&apos;envoi.
          </p>
          <ul className="divide-y divide-border">
            {variables.map((v) => (
              <li key={v.key} className="flex items-center gap-3 py-1.5">
                <button
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="shrink-0 cursor-pointer rounded-lg border border-border px-2 py-1 font-mono text-xs text-accent transition-colors duration-150 hover:bg-accent/10"
                >
                  {`{${v.key}}`}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{v.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Ex. {v.example}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "preview" && (
        <div className="p-3">
          <DiscordMessagePreview
            payload={value}
            variables={variables}
            botName={botName}
            botAvatar={botAvatar}
          />
        </div>
      )}
    </div>
  );
}

function EmbedEditor({
  index,
  embed,
  bind,
  patch,
  remove,
}: {
  index: number;
  embed: EmbedData;
  bind: (
    v: string,
    set: SetValue,
  ) => {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  };
  patch: (p: Partial<EmbedData>) => void;
  remove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const color = /^#[0-9a-fA-F]{6}$/.test(embed.color) ? embed.color : "#5865F2";

  const setField = (fi: number, p: Partial<EmbedData["fields"][number]>) =>
    patch({
      fields: embed.fields.map((f, idx) => (idx === fi ? { ...f, ...p } : f)),
    });

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-card px-3 py-1.5">
        <span
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <span className="flex-1 text-sm font-medium">Embed {index + 1}</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="grid size-7 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-card-hover hover:text-foreground"
          aria-label={open ? "Replier" : "Déplier"}
        >
          <ChevronDown
            className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={remove}
          className="grid size-7 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-card-hover hover:text-destructive"
          aria-label="Supprimer l'embed"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      {open && (
        <div className="space-y-2.5 p-2.5">
          <Row>
            <Labeled label="Auteur">
              <input
                placeholder="Nom de l'auteur"
                className={input}
                {...bind(embed.author.name, (v) =>
                  patch({ author: { ...embed.author, name: v } }),
                )}
              />
            </Labeled>
            <Labeled label="Icône auteur (URL)">
              <input
                placeholder="https://…"
                className={input}
                {...bind(embed.author.iconUrl, (v) =>
                  patch({ author: { ...embed.author, iconUrl: v } }),
                )}
              />
            </Labeled>
          </Row>

          <Row>
            <Labeled label="Titre">
              <input
                placeholder="Titre de l'embed"
                className={input}
                {...bind(embed.title, (v) => patch({ title: v }))}
              />
            </Labeled>
            <Labeled label="Lien du titre (URL)">
              <input
                placeholder="https://…"
                className={input}
                {...bind(embed.url, (v) => patch({ url: v }))}
              />
            </Labeled>
          </Row>

          <Labeled label="Description">
            <textarea
              rows={3}
              placeholder="Description (markdown supporté)…"
              className={input}
              {...bind(embed.description, (v) => patch({ description: v }))}
            />
          </Labeled>

          <Row>
            <Labeled label="Couleur">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => patch({ color: e.target.value })}
                  className="size-9 shrink-0 cursor-pointer rounded-lg border border-border bg-background"
                  aria-label="Couleur de l'embed"
                />
                <input
                  className={`${input} font-mono`}
                  {...bind(embed.color, (v) => patch({ color: v }))}
                />
              </div>
            </Labeled>
            <Labeled label="Image (URL)">
              <input
                placeholder="https://…"
                className={input}
                {...bind(embed.image, (v) => patch({ image: v }))}
              />
            </Labeled>
          </Row>

          <Row>
            <Labeled label="Miniature (URL)">
              <input
                placeholder="https://…"
                className={input}
                {...bind(embed.thumbnail, (v) => patch({ thumbnail: v }))}
              />
            </Labeled>
            <Labeled label="Footer">
              <input
                placeholder="Texte du footer"
                className={input}
                {...bind(embed.footer.text, (v) =>
                  patch({ footer: { ...embed.footer, text: v } }),
                )}
              />
            </Labeled>
          </Row>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={embed.timestamp}
              onChange={(e) => patch({ timestamp: e.target.checked })}
              className="size-4 accent-(--accent)"
            />
            Afficher l&apos;horodatage
          </label>

          {/* Champs (fields) */}
          <div className="space-y-2 border-t border-border pt-2.5">
            <p className="text-xs font-medium text-muted-foreground">Champs</p>
            {embed.fields.map((f, fi) => (
              <div
                key={fi}
                className="flex items-start gap-2 rounded-lg border border-border p-2"
              >
                <GripVertical
                  className="mt-2 size-4 shrink-0 text-muted-foreground/40"
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    placeholder="Nom du champ"
                    className={input}
                    {...bind(f.name, (v) => setField(fi, { name: v }))}
                  />
                  <textarea
                    rows={2}
                    placeholder="Valeur du champ"
                    className={input}
                    {...bind(f.value, (v) => setField(fi, { value: v }))}
                  />
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={f.inline}
                      onChange={(e) => setField(fi, { inline: e.target.checked })}
                      className="size-3.5 accent-(--accent)"
                    />
                    En ligne (côte à côte)
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    patch({ fields: embed.fields.filter((_, idx) => idx !== fi) })
                  }
                  className="grid size-7 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-card-hover hover:text-destructive"
                  aria-label="Supprimer le champ"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
            {embed.fields.length < FIELD_LIMIT && (
              <button
                type="button"
                onClick={() =>
                  patch({
                    fields: [
                      ...embed.fields,
                      { name: "", value: "", inline: false },
                    ],
                  })
                }
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
              >
                <Plus className="size-3.5" aria-hidden />
                Ajouter un champ
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="grid gap-2.5 sm:grid-cols-2">{children}</div>;
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

/** Version modale : un bouton qui ouvre le builder en superposition. */
export function MessageBuilderModal({
  triggerLabel = "Personnaliser le message",
  ...props
}: Parameters<typeof MessageBuilder>[0] & { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
      >
        <Pencil className="size-4" aria-hidden />
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="my-4 w-full max-w-4xl rounded-2xl border border-border bg-background p-4 shadow-xl sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Personnaliser le message</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-9 cursor-pointer place-items-center rounded-lg border border-border text-muted-foreground hover:bg-card-hover hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <MessageBuilder {...props} />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90"
              >
                Terminé
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
