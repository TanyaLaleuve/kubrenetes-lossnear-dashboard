import "server-only";
import { HOST_PORT_MAX, HOST_PORT_MIN } from "./k8s";

/**
 * Parse une spécification de ports : ports et plages séparés par virgules ou
 * espaces, ex. "25601, 25605, 25610-25615". Renvoie la liste triée, unique,
 * bornée à la plage globale. Lève une erreur lisible si un jeton est invalide
 * ou hors plage.
 */
export function parsePortSpec(spec: string): number[] {
  const set = new Set<number>();
  for (const raw of spec.split(/[,\s]+/)) {
    const token = raw.trim();
    if (!token) continue;
    const m = token.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new Error(`Port invalide : « ${token} ».`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    for (let p = lo; p <= hi; p++) {
      if (p < HOST_PORT_MIN || p > HOST_PORT_MAX) {
        throw new Error(
          `Port ${p} hors de la plage autorisée (${HOST_PORT_MIN}-${HOST_PORT_MAX}).`,
        );
      }
      set.add(p);
    }
  }
  return [...set].sort((x, y) => x - y);
}

/**
 * Liste des ports externes autorisés pour un utilisateur : sa liste allouée si
 * définie, sinon toute la plage globale.
 */
export function userAllowedPorts(user: {
  portAllowlist: string | null;
}): number[] {
  if (user.portAllowlist && user.portAllowlist.trim()) {
    return parsePortSpec(user.portAllowlist);
  }
  const all: number[] = [];
  for (let p = HOST_PORT_MIN; p <= HOST_PORT_MAX; p++) all.push(p);
  return all;
}

/** Bornes min/max des ports autorisés (pour les champs number). */
export function userPortBounds(user: { portAllowlist: string | null }): {
  min: number;
  max: number;
} {
  const ports = userAllowedPorts(user);
  return {
    min: ports[0] ?? HOST_PORT_MIN,
    max: ports[ports.length - 1] ?? HOST_PORT_MAX,
  };
}

/** Libellé lisible des ports autorisés (spec brute ou plage globale). */
export function portsLabel(user: { portAllowlist: string | null }): string {
  return user.portAllowlist?.trim() || `${HOST_PORT_MIN}-${HOST_PORT_MAX}`;
}
