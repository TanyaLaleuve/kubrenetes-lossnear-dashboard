import "server-only";

/**
 * Propriétés Minecraft booléennes exposées dans le panneau (page console).
 * Chaque entrée = une clé de server.properties + son défaut Mojang. L'ordre
 * suit la grille d'affichage.
 */
export const MC_BOOL_PROPS = [
  { key: "online-mode", label: "Mode online", def: true },
  { key: "pvp", label: "PvP", def: true },
  { key: "force-gamemode", label: "Forcer gamemode", def: false },
  { key: "generate-structures", label: "Générer structures", def: true },
  { key: "spawn-animals", label: "Présence animaux", def: true },
  { key: "spawn-monsters", label: "Présence monstres", def: true },
  { key: "spawn-npcs", label: "Générer NPCs", def: true },
  { key: "enable-command-block", label: "Blocs de commande", def: false },
  { key: "white-list", label: "Whitelist", def: false },
  { key: "allow-flight", label: "Autoriser le vol", def: false },
  { key: "allow-nether", label: "Autoriser le Nether", def: true },
  { key: "hardcore", label: "Hardcore", def: false },
] as const;

export type McPropKey = (typeof MC_BOOL_PROPS)[number]["key"];

const KNOWN = new Set<string>(MC_BOOL_PROPS.map((p) => p.key));

/** Parse un contenu server.properties en dictionnaire clé -> valeur brute. */
export function parseProperties(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

/**
 * Applique un changement de clé booléenne sur le texte server.properties.
 * Remplace la ligne si la clé existe, l'ajoute sinon. Préserve le reste.
 */
export function setProperty(text: string, key: string, value: boolean): string {
  const v = value ? "true" : "false";
  const lines = text.split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    const t = line.trim();
    if (t.startsWith("#")) return line;
    const eq = t.indexOf("=");
    if (eq !== -1 && t.slice(0, eq).trim() === key) {
      found = true;
      return `${key}=${v}`;
    }
    return line;
  });
  if (!found) {
    if (next.length && next[next.length - 1] === "") next.splice(next.length - 1, 0, `${key}=${v}`);
    else next.push(`${key}=${v}`);
  }
  return next.join("\n");
}

/** Extrait les booléens connus, en repliant sur le défaut Mojang si absent. */
export function readBooleans(props: Record<string, string>): Record<McPropKey, boolean> {
  const out = {} as Record<McPropKey, boolean>;
  for (const { key, def } of MC_BOOL_PROPS) {
    const raw = props[key];
    out[key] = raw === undefined ? def : raw.toLowerCase() === "true";
  }
  return out;
}

export function isKnownProp(key: string): key is McPropKey {
  return KNOWN.has(key);
}
