import "server-only";
import type {
  V1Container,
  V1Pod,
  V1Service,
  V1StatefulSet,
} from "@kubernetes/client-node";
import { appsApi, coreApi } from "@/lib/k8s/client";
import type { Server } from "@/lib/db/schema";
import { builtinVars, substituteVars } from "./eggs";

/** Marqueur écrit après une install réussie : évite de rejouer le script. */
const INSTALL_MARKER = ".lossnear-installed";
/** Où l'initContainer d'install monte le volume (façon Pterodactyl). */
const INSTALL_MOUNT = "/mnt/server";

export const SERVERS_NAMESPACE = "lossnear-servers";
export const HOST_PORT_MIN = 25600;
export const HOST_PORT_MAX = 25699;

function labels(server: Server) {
  return {
    "app.kubernetes.io/name": server.slug,
    "app.kubernetes.io/part-of": "lossnear-servers",
    "lossnear.com/server-id": server.id,
  };
}

/** Variables d'environnement du conteneur (env serveur + variables intégrées). */
function serverEnvVars(server: Server): Record<string, string> {
  return {
    ...builtinVars({
      memoryMi: server.memoryMi,
      containerPort: server.containerPort,
    }),
    ...server.env,
  };
}

/**
 * initContainer d'installation (serveurs egg) : monte le volume sur
 * /mnt/server et joue le script une seule fois, protégé par un marqueur.
 */
function buildInstallContainer(server: Server): V1Container | null {
  if (!server.startup || !server.installScript) return null;
  const vars = serverEnvVars(server);
  // Le script d'install de l'egg peut référencer {{VAR}} : on substitue avant.
  const script = substituteVars(server.installScript, vars);
  const marker = `${INSTALL_MOUNT}/${INSTALL_MARKER}`;
  const wrapped = [
    `if [ -f '${marker}' ]; then echo '[install] deja installe, skip'; exit 0; fi`,
    "set -e",
    "echo '[install] demarrage du script...'",
    script,
    `touch '${marker}'`,
    "echo '[install] termine.'",
  ].join("\n");

  return {
    name: "install",
    image: server.installContainer || "debian:bookworm-slim",
    command: [server.installEntrypoint || "bash", "-c", wrapped],
    workingDir: INSTALL_MOUNT,
    env: Object.entries(vars).map(([name, value]) => ({ name, value })),
    volumeMounts: [{ name: "data", mountPath: INSTALL_MOUNT }],
  };
}

/** Conteneur principal du serveur. */
function buildMainContainer(server: Server): V1Container {
  const vars = serverEnvVars(server);
  return {
    name: "server",
    image: server.image,
    // Serveur egg : commande shell (startup) avec substitution {{VAR}}.
    // Serveur image libre : args optionnels (`command`), sinon entrypoint image.
    ...(server.startup
      ? { command: ["/bin/sh", "-c", substituteVars(server.startup, vars)] }
      : server.command
        ? { args: server.command.split(/\s+/).filter(Boolean) }
        : {}),
    workingDir: server.mountPath,
    env: Object.entries(vars).map(([name, value]) => ({ name, value })),
    // stdin ouvert pour l'envoi de commandes (attach), mais SANS
    // pseudo-terminal : avec un tty, Minecraft dessine des barres de
    // progression ANSI qui polluent la console. Sans tty, il écrit
    // des logs texte propres.
    stdin: true,
    tty: false,
    ports: [
      {
        name: "game",
        containerPort: server.containerPort,
        hostPort: server.hostPort,
        protocol: "TCP",
      },
    ],
    volumeMounts: [{ name: "data", mountPath: server.mountPath }],
    resources: {
      requests: {
        cpu: `${Math.max(100, Math.floor(server.cpuMilli / 2))}m`,
        memory: `${server.memoryMi}Mi`,
      },
      limits: {
        cpu: `${server.cpuMilli}m`,
        memory: `${server.memoryMi}Mi`,
      },
    },
  };
}

function buildStatefulSet(server: Server): V1StatefulSet {
  const installContainer = buildInstallContainer(server);
  return {
    apiVersion: "apps/v1",
    kind: "StatefulSet",
    metadata: {
      name: server.slug,
      namespace: SERVERS_NAMESPACE,
      labels: labels(server),
    },
    spec: {
      serviceName: server.slug,
      replicas: server.desiredState === "running" ? 1 : 0,
      selector: { matchLabels: { "app.kubernetes.io/name": server.slug } },
      template: {
        metadata: { labels: labels(server) },
        spec: {
          terminationGracePeriodSeconds: 30,
          ...(server.nodeName ? { nodeName: server.nodeName } : {}),
          ...(installContainer ? { initContainers: [installContainer] } : {}),
          containers: [buildMainContainer(server)],
        },
      },
      volumeClaimTemplates: [
        {
          metadata: { name: "data" },
          spec: {
            accessModes: ["ReadWriteOnce"],
            storageClassName: "local-path",
            resources: { requests: { storage: `${server.diskGi}Gi` } },
          },
        },
      ],
    },
  };
}

function buildHeadlessService(server: Server): V1Service {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: server.slug,
      namespace: SERVERS_NAMESPACE,
      labels: labels(server),
    },
    spec: {
      clusterIP: "None",
      selector: { "app.kubernetes.io/name": server.slug },
      ports: [{ name: "game", port: server.containerPort }],
    },
  };
}

async function isNotFound(error: unknown): Promise<boolean> {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 404
  );
}

/** Crée ou met à jour les objets Kubernetes d'un serveur. */
export async function applyServer(server: Server): Promise<void> {
  const apps = appsApi();
  const core = coreApi();

  try {
    await core.readNamespacedService({
      namespace: SERVERS_NAMESPACE,
      name: server.slug,
    });
  } catch (error) {
    if (!(await isNotFound(error))) throw error;
    await core.createNamespacedService({
      namespace: SERVERS_NAMESPACE,
      body: buildHeadlessService(server),
    });
  }

  const replicas = server.desiredState === "running" ? 1 : 0;
  try {
    const existing = await apps.readNamespacedStatefulSet({
      namespace: SERVERS_NAMESPACE,
      name: server.slug,
    });
    // Mise à jour de la spec du StatefulSet pour refléter toute modification de config (RAM, CPU, Image, Node, Env)
    const updatedBody = buildStatefulSet(server);
    if (existing.metadata?.resourceVersion) {
      updatedBody.metadata = {
        ...updatedBody.metadata,
        resourceVersion: existing.metadata.resourceVersion,
      };
    }
    await apps.replaceNamespacedStatefulSet({
      namespace: SERVERS_NAMESPACE,
      name: server.slug,
      body: updatedBody,
    });
  } catch (error) {
    if (!(await isNotFound(error))) throw error;
    await apps.createNamespacedStatefulSet({
      namespace: SERVERS_NAMESPACE,
      body: buildStatefulSet(server),
    });
  }
}

/** Ajuste le nombre de replicas (start/stop) via le sous-objet scale. */
export async function setReplicas(
  slug: string,
  replicas: number,
): Promise<void> {
  const apps = appsApi();
  const scale = await apps.readNamespacedStatefulSetScale({
    namespace: SERVERS_NAMESPACE,
    name: slug,
  });
  scale.spec = { ...scale.spec, replicas };
  await apps.replaceNamespacedStatefulSetScale({
    namespace: SERVERS_NAMESPACE,
    name: slug,
    body: scale,
  });
}

/** Supprime le pod immédiatement (grace period 0) — arrêt dur. */
export async function forceDeletePod(slug: string): Promise<void> {
  try {
    await coreApi().deleteNamespacedPod({
      namespace: SERVERS_NAMESPACE,
      name: `${slug}-0`,
      gracePeriodSeconds: 0,
    });
  } catch (error) {
    if (!(await isNotFound(error))) throw error;
  }
}

/** Supprime StatefulSet + Service + volume de données (définitif). */
export async function destroyServer(server: Server): Promise<void> {
  const apps = appsApi();
  const core = coreApi();
  const swallow404 = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      if (!(await isNotFound(error))) throw error;
    }
  };

  await swallow404(() =>
    apps.deleteNamespacedStatefulSet({
      namespace: SERVERS_NAMESPACE,
      name: server.slug,
    }),
  );
  await swallow404(() =>
    core.deleteNamespacedService({
      namespace: SERVERS_NAMESPACE,
      name: server.slug,
    }),
  );
  await swallow404(() =>
    core.deleteNamespacedPersistentVolumeClaim({
      namespace: SERVERS_NAMESPACE,
      name: `data-${server.slug}-0`,
    }),
  );
}

export type ServerRuntimeStatus = {
  label: "Running" | "Starting" | "Stopped" | "Stopping" | "Error";
  tone: "ok" | "pending" | "muted" | "error";
  pod?: V1Pod;
};

/** Statut réel dérivé du pod (source de vérité Kubernetes). */
export async function serverRuntimeStatus(
  server: Server,
): Promise<ServerRuntimeStatus> {
  const pods = await coreApi().listNamespacedPod({
    namespace: SERVERS_NAMESPACE,
    labelSelector: `app.kubernetes.io/name=${server.slug}`,
  });
  const pod = pods.items[0];

  if (!pod) {
    return server.desiredState === "running"
      ? { label: "Starting", tone: "pending" }
      : { label: "Stopped", tone: "muted" };
  }
  if (pod.metadata?.deletionTimestamp) {
    return { label: "Stopping", tone: "pending", pod };
  }
  const waiting = pod.status?.containerStatuses?.[0]?.state?.waiting?.reason;
  if (waiting && waiting !== "ContainerCreating" && waiting !== "PodInitializing") {
    return { label: "Error", tone: "error", pod };
  }
  const ready = pod.status?.containerStatuses?.[0]?.ready ?? false;
  return ready
    ? { label: "Running", tone: "ok", pod }
    : { label: "Starting", tone: "pending", pod };
}
