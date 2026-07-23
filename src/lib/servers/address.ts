import type { Server } from "@/lib/db/schema";
import { PUBLIC_HOST } from "./constants";

/**
 * Hôte public d'un serveur : le domaine choisi par son propriétaire s'il y en
 * a un, sinon l'hôte du nœud. À utiliser partout où une adresse est montrée
 * (adresse de connexion, SFTP) pour que le domaine remplace bien le défaut.
 */
export function serverHost(server: Pick<Server, "displayAddress">): string {
  return server.displayAddress?.trim() || PUBLIC_HOST;
}

/**
 * Adresse de connexion affichée : hôte, suivi du port si le propriétaire n'a
 * pas masqué celui-ci (enregistrement SRV, port par défaut du jeu…).
 */
export function serverAddress(
  server: Pick<Server, "displayAddress" | "hostPort" | "showPort">,
): string {
  const host = serverHost(server);
  return server.showPort ? `${host}:${server.hostPort}` : host;
}
