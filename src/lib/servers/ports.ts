import "server-only";
import { HOST_PORT_MAX, HOST_PORT_MIN } from "./k8s";

/** Bornes absolues d'un port TCP. */
export const PORT_MIN = 1;
export const PORT_MAX = 65535;

/** Plage utilisée pour l'attribution AUTOMATIQUE (déjà ouverte dans ufw). */
export const AUTO_PORT_MIN = HOST_PORT_MIN;
export const AUTO_PORT_MAX = HOST_PORT_MAX;

/**
 * Ports réservés : services de l'hôte (SSH, nginx, Pterodactyl, bases de
 * données), plan de contrôle Kubernetes, et nos propres services. Les prendre
 * casserait la prod ou empêcherait le pod de démarrer.
 */
const RESERVED_SINGLE = new Set([
  22, // SSH
  53, // DNS
  80, 443, // nginx (panel Pterodactyl + dashboards)
  2022, // SFTP Pterodactyl
  2222, // SFTP agent lossnear
  2379, 2380, 2381, // etcd
  3306, // MariaDB
  5473, // Calico
  6379, // Redis
  6443, // kube-apiserver
  8080, // Wings (Pterodactyl)
  9098, 9099,
  11036,
  13001,
  27017, // MongoDB
  30080, 30443, // ingress-nginx (NodePort)
  45349,
]);

/** Plages réservées (bornes incluses). */
const RESERVED_RANGES: [number, number][] = [
  [10248, 10259], // kubelet / kube-proxy / controller-manager / scheduler
  [25565, 25570], // serveurs Minecraft Pterodactyl existants
];

export function isReservedPort(port: number): boolean {
  if (RESERVED_SINGLE.has(port)) return true;
  return RESERVED_RANGES.some(([lo, hi]) => port >= lo && port <= hi);
}

/**
 * Parse une spécification de ports : ports et plages séparés par virgules ou
 * espaces, ex. "25601, 25605, 25610-25615". Renvoie la liste triée, unique.
 * Lève une erreur lisible si un jeton est invalide, hors bornes ou réservé.
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
      if (p < PORT_MIN || p > PORT_MAX) {
        throw new Error(`Port ${p} hors bornes (${PORT_MIN}-${PORT_MAX}).`);
      }
      if (isReservedPort(p)) {
        throw new Error(`Port ${p} réservé au système, impossible à allouer.`);
      }
      set.add(p);
    }
  }
  return [...set].sort((x, y) => x - y);
}

/**
 * Ports autorisés pour un utilisateur : sa liste allouée, ou `null` s'il n'a
 * aucune restriction (il peut alors choisir n'importe quel port non réservé).
 */
export function userAllowedPorts(user: {
  portAllowlist: string | null;
}): number[] | null {
  if (user.portAllowlist && user.portAllowlist.trim()) {
    return parsePortSpec(user.portAllowlist);
  }
  return null;
}

/** Bornes min/max pour les champs number (indicatif). */
export function userPortBounds(user: { portAllowlist: string | null }): {
  min: number;
  max: number;
} {
  const ports = userAllowedPorts(user);
  if (!ports || ports.length === 0) return { min: PORT_MIN, max: PORT_MAX };
  return { min: ports[0], max: ports[ports.length - 1] };
}

/** Libellé lisible des ports autorisés. */
export function portsLabel(user: { portAllowlist: string | null }): string {
  return (
    user.portAllowlist?.trim() ||
    `n'importe quel port ${PORT_MIN}-${PORT_MAX} (hors ports réservés)`
  );
}
