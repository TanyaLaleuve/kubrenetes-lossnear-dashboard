import type { V1Pod } from "@kubernetes/client-node";

/** "250m" -> 0.25 ; "2" -> 2 (CPU en cœurs) */
export function parseCpu(value: string): number {
  if (value.endsWith("n")) return parseInt(value) / 1e9;
  if (value.endsWith("u")) return parseInt(value) / 1e6;
  if (value.endsWith("m")) return parseInt(value) / 1e3;
  return parseFloat(value);
}

/** "128974848", "129e6", "123Mi" -> octets */
export function parseMemory(value: string): number {
  const units: Record<string, number> = {
    Ki: 2 ** 10, Mi: 2 ** 20, Gi: 2 ** 30, Ti: 2 ** 40,
    K: 1e3, M: 1e6, G: 1e9, T: 1e12,
  };
  const match = value.match(/^([0-9.e+]+)([A-Za-z]*)$/);
  if (!match) return 0;
  return parseFloat(match[1]) * (units[match[2]] ?? 1);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 2 ** 30) return `${(bytes / 2 ** 30).toFixed(1)} Gio`;
  if (bytes >= 2 ** 20) return `${(bytes / 2 ** 20).toFixed(0)} Mio`;
  return `${(bytes / 2 ** 10).toFixed(0)} Kio`;
}

export function formatCpu(cores: number): string {
  return cores >= 1 ? `${cores.toFixed(2)} cœurs` : `${Math.round(cores * 1000)}m`;
}

export function formatAge(timestamp?: Date | string): string {
  if (!timestamp) return "—";
  const seconds = Math.floor((Date.now() - new Date(timestamp).valueOf()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}j`;
}

export type PodDisplayStatus = {
  label: string;
  tone: "ok" | "pending" | "error" | "muted";
  ready: string;
  restarts: number;
};

/** Statut affichable d'un pod, proche de la colonne STATUS de kubectl. */
export function podStatus(pod: V1Pod): PodDisplayStatus {
  const statuses = pod.status?.containerStatuses ?? [];
  const readyCount = statuses.filter((c) => c.ready).length;
  const restarts = statuses.reduce((sum, c) => sum + c.restartCount, 0);
  const base = {
    ready: `${readyCount}/${statuses.length || pod.spec?.containers.length || 0}`,
    restarts,
  };

  if (pod.metadata?.deletionTimestamp) {
    return { ...base, label: "Terminating", tone: "muted" };
  }
  const waiting = statuses.find((c) => c.state?.waiting?.reason);
  if (waiting?.state?.waiting?.reason) {
    const reason = waiting.state.waiting.reason;
    const tone =
      reason === "ContainerCreating" || reason === "PodInitializing"
        ? "pending"
        : "error";
    return { ...base, label: reason, tone };
  }
  const phase = pod.status?.phase ?? "Unknown";
  if (phase === "Running") {
    return readyCount === statuses.length
      ? { ...base, label: "Running", tone: "ok" }
      : { ...base, label: "Running", tone: "pending" };
  }
  if (phase === "Succeeded") return { ...base, label: "Succeeded", tone: "muted" };
  if (phase === "Pending") return { ...base, label: "Pending", tone: "pending" };
  return { ...base, label: phase, tone: "error" };
}
