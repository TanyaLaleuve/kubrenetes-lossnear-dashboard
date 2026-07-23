/** Placeholder du formulaire = valeur par défaut si champ laissé vide. */
export const DEFAULT_IMAGE = "itzg/minecraft-server:latest";

/** Image Java 8 pour les vieilles versions de Minecraft (1.8.x - 1.16). */
export const LEGACY_MC_IMAGE = "itzg/minecraft-server:java8-multiarch";

/**
 * Hôte public du nœud, exposé aux joueurs (adresse de connexion, SFTP).
 * Volontairement un nom DNS et pas une IP : migrer le serveur ou changer
 * d'hébergeur ne demande qu'un changement d'enregistrement DNS, aucun
 * redéploiement. Doit pointer sur l'IP publique du nœud.
 */
export const PUBLIC_HOST = "node1.lossnear.com";
