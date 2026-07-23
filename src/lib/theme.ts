/**
 * Thème personnalisable côté navigateur. Les couleurs vivent dans des variables
 * CSS (:root de globals.css) ; on les surcharge à l'exécution en posant les
 * mêmes variables en inline sur <html>. Rien côté serveur : c'est une
 * préférence locale, mémorisée en localStorage, testable en temps réel.
 */

export const THEME_STORAGE_KEY = "lossnear:theme";

/** Jetons de couleur modifiables, dans l'ordre d'affichage du personnalisateur. */
export const THEME_TOKENS = [
  { key: "accent", label: "Accent", hint: "Boutons, liens, éléments actifs" },
  { key: "accent-foreground", label: "Texte sur accent", hint: "Texte des boutons pleins" },
  { key: "background", label: "Fond", hint: "Arrière-plan général" },
  { key: "foreground", label: "Texte", hint: "Texte principal" },
  { key: "card", label: "Cartes", hint: "Panneaux et encarts" },
  { key: "card-hover", label: "Cartes (survol)", hint: "Survol des panneaux" },
  { key: "muted", label: "Atténué", hint: "Fonds secondaires" },
  { key: "muted-foreground", label: "Texte atténué", hint: "Légendes, descriptions" },
  { key: "border", label: "Bordures", hint: "Traits et séparateurs" },
  { key: "warning", label: "Avertissement", hint: "États en attente" },
  { key: "destructive", label: "Danger", hint: "Suppression, erreurs" },
  { key: "info", label: "Info", hint: "Informations neutres" },
] as const;

export type ThemeToken = (typeof THEME_TOKENS)[number]["key"];
export type Theme = Record<ThemeToken, string>;

/** Thème par défaut : DOIT rester synchronisé avec :root dans globals.css. */
export const DEFAULT_THEME: Theme = {
  background: "#020617",
  foreground: "#f8fafc",
  card: "#0f172a",
  "card-hover": "#16213b",
  muted: "#1a1e2f",
  "muted-foreground": "#94a3b8",
  border: "#26334d",
  accent: "#7dd3fc",
  "accent-foreground": "#04121f",
  warning: "#fcd34d",
  destructive: "#ef4444",
  info: "#818cf8",
};

/** Palettes prêtes à l'emploi. La première est le thème par défaut. */
export const THEME_PRESETS: { name: string; theme: Theme }[] = [
  { name: "Bleu lossnear", theme: DEFAULT_THEME },
  {
    name: "Bleu nuit + ambre",
    theme: {
      ...DEFAULT_THEME,
      accent: "#38bdf8",
      "accent-foreground": "#04121f",
      warning: "#f59e0b",
      info: "#a78bfa",
    },
  },
  {
    name: "Émeraude",
    theme: {
      ...DEFAULT_THEME,
      accent: "#34d399",
      "accent-foreground": "#04120a",
      warning: "#fbbf24",
    },
  },
  {
    name: "Violet",
    theme: {
      background: "#0e0b1a",
      foreground: "#f5f3ff",
      card: "#181231",
      "card-hover": "#221a41",
      muted: "#1f1838",
      "muted-foreground": "#a99fc4",
      border: "#332a52",
      accent: "#c4b5fd",
      "accent-foreground": "#160a2b",
      warning: "#fcd34d",
      destructive: "#f87171",
      info: "#7dd3fc",
    },
  },
  {
    name: "Rose pastel",
    theme: {
      background: "#120810",
      foreground: "#fbf3f8",
      card: "#1e1019",
      "card-hover": "#291725",
      muted: "#241320",
      "muted-foreground": "#c2a2b3",
      border: "#3b2333",
      accent: "#f9a8d4",
      "accent-foreground": "#2a0a1a",
      warning: "#fcd34d",
      destructive: "#f87171",
      info: "#7dd3fc",
    },
  },
  {
    name: "Ambre chaud",
    theme: {
      background: "#140f06",
      foreground: "#fdf6ec",
      card: "#201808",
      "card-hover": "#2c2110",
      muted: "#281e0c",
      "muted-foreground": "#c8b48f",
      border: "#3d2f15",
      accent: "#fbbf24",
      "accent-foreground": "#1a1204",
      warning: "#fcd34d",
      destructive: "#f87171",
      info: "#7dd3fc",
    },
  },
  {
    name: "Cyan glacé",
    theme: {
      ...DEFAULT_THEME,
      accent: "#67e8f9",
      "accent-foreground": "#04141a",
      info: "#818cf8",
    },
  },
  {
    name: "Ardoise neutre",
    theme: {
      ...DEFAULT_THEME,
      accent: "#cbd5e1",
      "accent-foreground": "#0b1120",
      warning: "#eab308",
      info: "#60a5fa",
    },
  },
];

/** Applique un thème sur <html> (surcharge inline des variables CSS). */
export function applyTheme(theme: Partial<Theme>): void {
  const root = document.documentElement;
  for (const { key } of THEME_TOKENS) {
    const value = theme[key];
    if (value) root.style.setProperty(`--${key}`, value);
    else root.style.removeProperty(`--${key}`);
  }
}

/** Retire toute surcharge : retour aux valeurs de globals.css. */
export function clearTheme(): void {
  const root = document.documentElement;
  for (const { key } of THEME_TOKENS) root.style.removeProperty(`--${key}`);
}

/** Lit le thème enregistré (ou null). Tolère un JSON corrompu. */
export function readStoredTheme(): Partial<Theme> | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Theme> = {};
    for (const { key } of THEME_TOKENS) {
      const v = parsed[key];
      if (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v)) out[key] = v;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // stockage indisponible (navigation privée) — la préférence ne survivra
    // pas au rechargement, mais l'aperçu en direct fonctionne quand même.
  }
}

export function forgetTheme(): void {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // rien à faire
  }
}
