import "server-only";
import type { ServerNavTabs } from "@/components/ServerNav";
import type { ServerAccess } from "./authz";

/**
 * Onglets visibles du bandeau serveur, calculés depuis les permissions
 * effectives. Startup a sa propre entrée (plus dans Paramètres) ; Paramètres ne
 * regroupe plus que Général et Gestion & Migration.
 */
export function serverNavProps(access: ServerAccess): {
  shortId: string;
  tabs: ServerNavTabs;
  settingsHref: string;
} {
  const { server, permissions, privileged } = access;

  const canGeneral = privileged || permissions.has("settings.general");
  const canManage = privileged || permissions.has("settings.manage");

  return {
    shortId: server.shortId,
    tabs: {
      files: permissions.has("files.read"),
      members: permissions.has("members.read"),
      startup: privileged || permissions.has("settings.egg"),
      backups: permissions.has("backups.read"),
      ai: permissions.has("ai.use"),
      settings: canGeneral || canManage,
    },
    // Premier onglet réellement accessible, pour ne pas atterrir sur Général
    // sans en avoir la permission.
    settingsHref: canGeneral
      ? `/servers/${server.shortId}/settings`
      : `/servers/${server.shortId}/settings/management`,
  };
}
