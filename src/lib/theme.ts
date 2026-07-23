/**
 * Thème de couleurs global du site. Les couleurs vivent dans des variables CSS
 * (:root de globals.css). L'administration en choisit une palette, stockée en
 * base et appliquée à tout le monde : le layout racine pose ces variables sur
 * <html> au rendu serveur (pas de flash, pas de JS requis).
 */

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
  { key: "success", label: "Succès", hint: "Encart SFTP, confirmations" },
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
  success: "#22c55e",
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
      success: "#4ade80",
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
      success: "#4ade80",
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
      success: "#4ade80",
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

const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * Ne garde que des couples jeton connu -> hexa valide. Sert de garde à la
 * lecture (base) comme à l'écriture (action serveur).
 */
export function sanitizeTheme(input: unknown): Partial<Theme> {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const out: Partial<Theme> = {};
  for (const { key } of THEME_TOKENS) {
    const v = raw[key];
    if (typeof v === "string" && HEX_RE.test(v)) out[key] = v;
  }
  return out;
}

/** Complète une palette partielle avec le défaut pour obtenir un thème plein. */
export function resolveTheme(partial: Partial<Theme> | null | undefined): Theme {
  return { ...DEFAULT_THEME, ...(partial ?? {}) };
}

/**
 * Style inline pour <html> : une déclaration `--jeton: valeur` par couleur qui
 * diffère du défaut (inutile de répéter les valeurs déjà dans globals.css).
 */
export function themeStyle(partial: Partial<Theme> | null | undefined): Record<string, string> {
  const style: Record<string, string> = {};
  const clean = sanitizeTheme(partial);
  for (const { key } of THEME_TOKENS) {
    const v = clean[key];
    if (v && v.toLowerCase() !== DEFAULT_THEME[key].toLowerCase()) {
      style[`--${key}`] = v;
    }
  }
  return style;
}

/** Applique un thème sur <html> côté client (aperçu en direct). */
export function applyTheme(theme: Partial<Theme>): void {
  const root = document.documentElement;
  for (const { key } of THEME_TOKENS) {
    const value = theme[key];
    if (value) root.style.setProperty(`--${key}`, value);
    else root.style.removeProperty(`--${key}`);
  }
}

/** Nom de la palette exactement égale au thème donné, sinon null. */
export function matchPreset(theme: Theme): string | null {
  for (const preset of THEME_PRESETS) {
    if (THEME_TOKENS.every(({ key }) => preset.theme[key] === theme[key])) {
      return preset.name;
    }
  }
  return null;
}
