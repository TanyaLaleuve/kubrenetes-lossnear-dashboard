/**
 * Permissions d'accès aux sections du dashboard, par utilisateur.
 * Les admins (isAdmin) ont accès à tout d'office, sans dépendre de cette liste.
 *
 * Chaque clé correspond à une section de navigation / un groupe de pages.
 */

export const DASHBOARD_PERMISSION_GROUPS = [
  {
    key: "servers",
    label: "Serveurs",
    perms: [
      {
        key: "view.servers",
        label: "Section Serveurs",
        hint: "Voir et gérer ses serveurs (+ ceux où l'on est invité).",
      },
    ],
  },
  {
    key: "cluster",
    label: "Cluster (infrastructure)",
    perms: [
      { key: "view.overview", label: "Vue d'ensemble" },
      { key: "view.pods", label: "Pods" },
      { key: "view.workloads", label: "Workloads" },
      { key: "view.system", label: "Système" },
      { key: "view.nodes", label: "Nœuds" },
      { key: "view.namespaces", label: "Namespaces" },
    ],
  },
] as const;

export const ALL_DASHBOARD_PERMISSIONS = DASHBOARD_PERMISSION_GROUPS.flatMap(
  (group) => group.perms.map((p) => p.key),
) as string[];

export type DashboardPermission = (typeof ALL_DASHBOARD_PERMISSIONS)[number];

/** Permissions accordées par défaut à un nouveau compte non-admin. */
export const DEFAULT_DASHBOARD_PERMISSIONS: string[] = ["view.servers"];

/** Filtre une liste de clés pour ne garder que des permissions connues. */
export function sanitizeDashboardPermissions(input: string[]): string[] {
  const allowed = new Set(ALL_DASHBOARD_PERMISSIONS);
  return [...new Set(input)].filter((key) => allowed.has(key));
}

/** Un utilisateur a-t-il accès à une section ? (admin = toujours oui) */
export function canAccess(
  user: { isAdmin: boolean; permissions: string[] },
  perm: string,
): boolean {
  return user.isAdmin || user.permissions.includes(perm);
}

/**
 * Page d'atterrissage selon les droits : la vue d'ensemble si autorisée,
 * sinon les serveurs, sinon le profil (toujours accessible).
 */
export function landingPath(user: {
  isAdmin: boolean;
  permissions: string[];
}): string {
  if (canAccess(user, "view.overview")) return "/";
  if (canAccess(user, "view.servers")) return "/servers";
  return "/profile";
}
