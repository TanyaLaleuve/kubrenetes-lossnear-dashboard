// Permissions par serveur (modèle inspiré de Pterodactyl).
// Le propriétaire et les admins ont toutes les permissions ; les membres
// invités reçoivent un sous-ensemble.

export type Permission = string;

export const PERMISSION_GROUPS = [
  {
    key: "control",
    label: "Contrôle",
    perms: [
      { key: "control.start", label: "Démarrer" },
      { key: "control.stop", label: "Arrêter" },
      { key: "control.restart", label: "Redémarrer" },
      { key: "control.kill", label: "Kill (arrêt forcé)" },
    ],
  },
  {
    key: "console",
    label: "Console",
    perms: [
      { key: "console.read", label: "Voir la console" },
      { key: "console.command", label: "Envoyer des commandes" },
    ],
  },
  {
    key: "files",
    label: "Fichiers",
    perms: [
      { key: "files.read", label: "Lire / télécharger" },
      { key: "files.write", label: "Modifier / créer / envoyer" },
      { key: "files.delete", label: "Supprimer" },
      { key: "files.sftp", label: "Accès SFTP" },
    ],
  },
  {
    key: "members",
    label: "Membres",
    perms: [
      { key: "members.read", label: "Voir les membres" },
      { key: "members.manage", label: "Gérer les membres et permissions" },
    ],
  },
  {
    key: "settings",
    label: "Paramètres",
    perms: [
      {
        key: "settings.general",
        label: "Général (nom, ressources, ports, adresse)",
      },
      { key: "settings.egg", label: "Egg / Conteneur" },
      { key: "settings.manage", label: "Gestion (réinstaller, migrer)" },
    ],
  },
] as const;

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) =>
  g.perms.map((p) => p.key),
);

const PERMISSION_SET = new Set(ALL_PERMISSIONS);

/** Ne garde que les clés de permission valides (nettoyage d'entrée). */
export function sanitizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (p): p is string => typeof p === "string" && PERMISSION_SET.has(p),
  );
}

/** Permissions par défaut proposées pour un nouveau membre (lecture seule). */
export const DEFAULT_MEMBER_PERMISSIONS: Permission[] = [
  "console.read",
  "files.read",
  "members.read",
];
