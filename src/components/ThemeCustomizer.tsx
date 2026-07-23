"use client";

import { useState, useTransition } from "react";
import { Check, Globe, Paintbrush, RotateCcw } from "lucide-react";
import {
  DEFAULT_THEME,
  THEME_PRESETS,
  THEME_TOKENS,
  applyTheme,
  matchPreset,
  type Theme,
} from "@/lib/theme";
import {
  resetSiteTheme,
  saveSiteTheme,
  type ThemeFormState,
} from "@/lib/theme-actions";

/**
 * Personnalisateur de palette (administration) : palettes prêtes + réglage
 * jeton par jeton, aperçu en direct sur tout le site, puis application globale
 * pour tous les utilisateurs. « Réinitialiser » remet le thème par défaut.
 */
export function ThemeCustomizer({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const [feedback, setFeedback] = useState<ThemeFormState>({});
  const [pending, startTransition] = useTransition();
  const activePreset = matchPreset(theme);

  // Aperçu local immédiat : pose les variables sur <html> sans passer par le
  // serveur. L'enregistrement seul les rend permanentes et globales.
  function preview(next: Theme) {
    setTheme(next);
    setFeedback({});
    applyTheme(next);
  }

  function setToken(key: string, value: string) {
    preview({ ...theme, [key]: value });
  }

  function save() {
    startTransition(async () => setFeedback(await saveSiteTheme(theme)));
  }

  function reset() {
    setTheme(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
    startTransition(async () => setFeedback(await resetSiteTheme()));
  }

  return (
    <div className="space-y-8">
      {/* Palettes prêtes à l'emploi */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Paintbrush className="size-4" aria-hidden />
          Palettes
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {THEME_PRESETS.map((preset) => {
            const active = activePreset === preset.name;
            return (
              <li key={preset.name}>
                <button
                  type="button"
                  onClick={() => preview({ ...preset.theme })}
                  aria-pressed={active}
                  className={`flex w-full flex-col gap-2 rounded-xl border p-3 text-left transition-colors duration-150 ${
                    active
                      ? "border-accent bg-accent/10"
                      : "border-border bg-card hover:bg-card-hover"
                  }`}
                >
                  <span
                    className="flex h-12 items-center gap-1.5 rounded-lg px-2"
                    style={{ background: preset.theme.background }}
                  >
                    <Swatch color={preset.theme.accent} />
                    <Swatch color={preset.theme.warning} />
                    <Swatch color={preset.theme.info} />
                    <span
                      className="ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: preset.theme.accent,
                        color: preset.theme["accent-foreground"],
                      }}
                    >
                      Aa
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    {active && <Check className="size-3.5 text-accent" aria-hidden />}
                    {preset.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Réglage fin par jeton */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Réglage détaillé
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {THEME_TOKENS.map(({ key, label, hint }) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <input
                type="color"
                value={theme[key]}
                onChange={(e) => setToken(key, e.target.value)}
                aria-label={label}
                className="size-9 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{label}</p>
                <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
              </div>
              <input
                type="text"
                value={theme[key]}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (/^#[0-9a-f]{6}$/i.test(v)) setToken(key, v);
                }}
                spellCheck={false}
                aria-label={`${label} (code hexadécimal)`}
                className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs uppercase outline-none transition-colors duration-150 focus:border-accent"
              />
            </div>
          ))}
        </div>
      </section>

      <Preview />

      {/* Barre d'action : sauvegarde globale */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/95 p-3 backdrop-blur">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
        >
          <Globe className="size-4" aria-hidden />
          {pending ? "…" : "Appliquer à tout le site"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={pending}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw className="size-4" aria-hidden />
          Réinitialiser
        </button>
        {feedback.error && (
          <span role="alert" className="text-sm text-destructive">
            {feedback.error}
          </span>
        )}
        {feedback.success && (
          <span className="text-sm text-accent">{feedback.success}</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          L&apos;aperçu est immédiat ; « Appliquer » enregistre pour tout le monde.
        </span>
      </div>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="size-4 rounded-full ring-1 ring-white/10"
      style={{ background: color }}
      aria-hidden
    />
  );
}

/** Petit échantillon d'interface pour juger le rendu sans quitter la page. */
function Preview() {
  const [checked, setChecked] = useState(true);
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">Aperçu</h2>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground">
            Bouton principal
          </button>
          <button className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground">
            Secondaire
          </button>
          <button className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-white">
            Supprimer
          </button>
          <span className="rounded-full border border-accent/30 bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
            En marche
          </span>
          <span className="rounded-full border border-warning/30 bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">
            En attente
          </span>
          <span className="rounded-full border border-info/30 bg-info/15 px-2.5 py-0.5 text-xs font-medium text-info">
            Info
          </span>
        </div>
        <p className="text-sm">
          Texte principal, avec un{" "}
          <a href="#" className="text-accent underline">
            lien accentué
          </a>{" "}
          et du <span className="text-muted-foreground">texte atténué</span>.
        </p>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-5 w-9 shrink-0 rounded-full bg-border transition-colors duration-150 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-150 peer-checked:bg-accent peer-checked:after:translate-x-4"
          />
          <span className="text-sm">Interrupteur d&apos;exemple</span>
        </label>
      </div>
    </section>
  );
}
