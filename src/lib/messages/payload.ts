/**
 * Représentation d'un message Discord éditable (contenu + embeds), partagée
 * entre le builder (client) et l'envoi côté bot (plus tard). Volontairement
 * proche du format de l'API Discord pour une conversion directe.
 */

export type EmbedField = {
  name: string;
  value: string;
  inline: boolean;
};

export type EmbedData = {
  author: { name: string; url: string; iconUrl: string };
  title: string;
  url: string;
  description: string;
  /** Couleur hex "#rrggbb" ou "" (pas de barre colorée). */
  color: string;
  fields: EmbedField[];
  image: string;
  thumbnail: string;
  footer: { text: string; iconUrl: string };
  /** Affiche l'horodatage courant dans le footer. */
  timestamp: boolean;
};

export type MessagePayload = {
  content: string;
  embeds: EmbedData[];
};

/** Variable insérable, avec son explication et une valeur d'exemple (aperçu). */
export type MessageVariable = {
  key: string;
  label: string;
  example: string;
};

export const EMBED_LIMIT = 10;
export const FIELD_LIMIT = 25;
export const CONTENT_LIMIT = 2000;

export function emptyEmbed(): EmbedData {
  return {
    author: { name: "", url: "", iconUrl: "" },
    title: "",
    url: "",
    description: "",
    color: "#5865F2",
    fields: [],
    image: "",
    thumbnail: "",
    footer: { text: "", iconUrl: "" },
    timestamp: false,
  };
}

export function emptyPayload(): MessagePayload {
  return { content: "", embeds: [] };
}

/** Un embed est-il visuellement vide (rien à afficher) ? */
export function isEmbedEmpty(e: EmbedData): boolean {
  return (
    !e.title &&
    !e.description &&
    !e.author.name &&
    !e.image &&
    !e.thumbnail &&
    !e.footer.text &&
    e.fields.every((f) => !f.name && !f.value)
  );
}

/** Remplace {clé} par la valeur d'exemple des variables (pour l'aperçu). */
export function substituteVariables(
  text: string,
  variables: MessageVariable[],
): string {
  if (!text) return text;
  const byKey = new Map(variables.map((v) => [v.key, v.example]));
  return text.replace(/\{([a-zA-Z0-9_.]+)\}/g, (whole, key: string) =>
    byKey.has(key) ? byKey.get(key)! : whole,
  );
}

/** Variables génériques par défaut (contexte serveur, communes à tout). */
export const DEFAULT_VARIABLES: MessageVariable[] = [
  { key: "server", label: "Nom du serveur", example: "LossNear" },
  { key: "server.members", label: "Nombre de membres", example: "1 337" },
  { key: "channel", label: "Salon courant", example: "#général" },
  { key: "date", label: "Date du jour", example: "23/07/2026" },
];
