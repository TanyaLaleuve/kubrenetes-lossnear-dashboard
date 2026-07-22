import "server-only";
import { HOST_PORT_MAX, HOST_PORT_MIN } from "./k8s";

/**
 * Plage de ports externes effective d'un utilisateur : sa plage allouée si
 * définie, sinon la plage globale, toujours bornée à la plage globale (seule
 * ouverte dans le pare-feu).
 */
export function userPortRange(user: {
  portRangeStart: number | null;
  portRangeEnd: number | null;
}): { min: number; max: number } {
  const min = Math.max(user.portRangeStart ?? HOST_PORT_MIN, HOST_PORT_MIN);
  const max = Math.min(user.portRangeEnd ?? HOST_PORT_MAX, HOST_PORT_MAX);
  return { min, max: Math.max(min, max) };
}
