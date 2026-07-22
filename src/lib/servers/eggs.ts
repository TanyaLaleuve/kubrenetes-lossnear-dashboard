import { z } from "zod";

/**
 * Un « egg » (œuf) est un modèle de serveur, à la Pterodactyl : il décrit
 * l'image (ou les variantes d'image), la commande de démarrage, l'éventuel
 * script d'installation et les variables configurables par l'utilisateur.
 *
 * On importe le format d'export Pterodactyl (PTDL_v2) et on gère aussi des
 * templates maison via le même modèle.
 */

/** Répertoire de travail par défaut d'un serveur créé depuis un egg. */
export const EGG_MOUNT_PATH = "/home/container";
/** Image d'installation par défaut si l'egg n'en précise pas. */
export const DEFAULT_INSTALL_CONTAINER = "debian:bookworm-slim";
export const DEFAULT_INSTALL_ENTRYPOINT = "bash";

export type EggVariable = {
  name: string;
  description: string;
  /** Nom de la variable d'environnement (clé dans server.env et dans {{...}}). */
  envVariable: string;
  defaultValue: string;
  /** L'utilisateur peut modifier la valeur à la création du serveur. */
  userEditable: boolean;
  /** L'utilisateur voit la variable (sinon elle est cachée mais appliquée). */
  userViewable: boolean;
  /** Règles Pterodactyl (Laravel) — conservées pour affichage/validation légère. */
  rules: string;
};

export type EggInput = {
  name: string;
  description: string;
  author: string | null;
  dockerImages: Record<string, string>;
  startup: string;
  stopCommand: string | null;
  installScript: string | null;
  installContainer: string;
  installEntrypoint: string;
  variables: EggVariable[];
};

// ---- Import d'un egg Pterodactyl (format PTDL_v2) ----

const pteroVariableSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  env_variable: z.string(),
  default_value: z.union([z.string(), z.number(), z.boolean(), z.null()]).default(""),
  user_viewable: z.boolean().default(true),
  user_editable: z.boolean().default(true),
  rules: z.string().default(""),
});

const pteroEggSchema = z.object({
  name: z.string().min(1),
  author: z.string().nullish(),
  description: z.string().nullish(),
  // Format récent : map {label: image}. Ancien : image unique (string).
  docker_images: z.record(z.string(), z.string()).optional(),
  image: z.string().optional(),
  startup: z.string().default(""),
  config: z
    .object({
      // `stop` peut être une commande ("stop") ou un signal ("^C").
      stop: z.string().nullish(),
    })
    .partial()
    .optional(),
  scripts: z
    .object({
      installation: z
        .object({
          script: z.string().nullish(),
          container: z.string().nullish(),
          entrypoint: z.string().nullish(),
        })
        .partial()
        .optional(),
    })
    .optional(),
  variables: z.array(pteroVariableSchema).default([]),
});

/**
 * Parse un JSON d'egg Pterodactyl en EggInput. Lève une erreur lisible si le
 * format est invalide.
 */
export function parsePterodactylEgg(raw: unknown): EggInput {
  const parsed = pteroEggSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      "Egg Pterodactyl invalide (champs name/startup/variables attendus).",
    );
  }
  const e = parsed.data;

  let dockerImages: Record<string, string> = {};
  if (e.docker_images && Object.keys(e.docker_images).length > 0) {
    dockerImages = e.docker_images;
  } else if (e.image) {
    dockerImages = { [e.image]: e.image };
  }
  if (Object.keys(dockerImages).length === 0) {
    throw new Error("Aucune image Docker dans l'egg.");
  }

  const install = e.scripts?.installation;

  return {
    name: e.name.slice(0, 96),
    description: (e.description ?? "").slice(0, 2000),
    author: e.author?.slice(0, 128) ?? null,
    dockerImages,
    startup: e.startup,
    stopCommand: e.config?.stop?.trim() ? e.config.stop.trim() : null,
    installScript: install?.script?.trim() ? install.script : null,
    installContainer:
      install?.container?.trim() || DEFAULT_INSTALL_CONTAINER,
    installEntrypoint:
      install?.entrypoint?.trim() || DEFAULT_INSTALL_ENTRYPOINT,
    variables: e.variables.map((v) => ({
      name: v.name || v.env_variable,
      description: v.description ?? "",
      envVariable: v.env_variable,
      defaultValue:
        v.default_value === null ? "" : String(v.default_value),
      userEditable: v.user_editable,
      userViewable: v.user_viewable,
      rules: v.rules ?? "",
    })),
  };
}

// ---- Substitution des variables {{...}} ----

/**
 * Variables intégrées façon Pterodactyl, disponibles dans startup/install
 * même si l'egg ne les déclare pas.
 */
export function builtinVars(input: {
  memoryMi: number;
  containerPort: number;
}): Record<string, string> {
  return {
    SERVER_MEMORY: String(input.memoryMi),
    SERVER_PORT: String(input.containerPort),
    SERVER_IP: "0.0.0.0",
  };
}

/**
 * Remplace les jetons {{CLE}} par la valeur d'environnement correspondante.
 * Les jetons inconnus sont remplacés par une chaîne vide (comportement Ptero).
 */
export function substituteVars(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key: string) =>
    key in vars ? vars[key] : "",
  );
}

/**
 * Construit la table de variables à partir des valeurs saisies + défauts de
 * l'egg + variables intégrées. Les variables non modifiables gardent leur
 * défaut ; les valeurs saisies ne sont retenues que pour les variables éditables.
 */
export function resolveEnv(
  variables: EggVariable[],
  submitted: Record<string, string>,
  builtins: Record<string, string>,
): Record<string, string> {
  const env: Record<string, string> = { ...builtins };
  for (const v of variables) {
    const canEdit = v.userEditable;
    const value =
      canEdit && typeof submitted[v.envVariable] === "string"
        ? submitted[v.envVariable]
        : v.defaultValue;
    env[v.envVariable] = value;
  }
  return env;
}
