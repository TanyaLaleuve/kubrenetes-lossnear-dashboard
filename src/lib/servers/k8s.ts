import "server-only";
import type { V1Pod, V1Service, V1StatefulSet } from "@kubernetes/client-node";
import { appsApi, coreApi } from "@/lib/k8s/client";
import type { Server } from "@/lib/db/schema";

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

function buildStatefulSet(server: Server): V1StatefulSet {
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
          terminationGracePeriodSeconds: 60,
          containers: [
            {
              name: "server",
              image: server.image,
              ...(server.command
                ? { args: server.command.split(/\s+/).filter(Boolean) }
                : {}),
              env: Object.entries(server.env).map(([name, value]) => ({
                name,
                value,
              })),
              // stdin/tty : nécessaires pour la console interactive (phase 2)
              stdin: true,
              tty: true,
              ports: [
                {
                  name: "game",
                  containerPort: server.containerPort,
                  hostPort: server.hostPort,
                  protocol: "TCP",
                },
              ],
              volumeMounts: [{ name: "data", mountPath: "/data" }],
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
            },
          ],
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

  const body = buildStatefulSet(server);
  try {
    await apps.readNamespacedStatefulSet({
      namespace: SERVERS_NAMESPACE,
      name: server.slug,
    });
    await apps.replaceNamespacedStatefulSet({
      namespace: SERVERS_NAMESPACE,
      name: server.slug,
      body,
    });
  } catch (error) {
    if (!(await isNotFound(error))) throw error;
    await apps.createNamespacedStatefulSet({
      namespace: SERVERS_NAMESPACE,
      body,
    });
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
