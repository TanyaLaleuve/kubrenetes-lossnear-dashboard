import "server-only";
import type {
  V1Deployment,
  V1Namespace,
  V1Node,
  V1Pod,
  CoreV1Event,
  NodeMetric,
  PodMetric,
} from "@kubernetes/client-node";
import { appsApi, coreApi, metricsClient } from "./client";

export async function listNodes(): Promise<V1Node[]> {
  const res = await coreApi().listNode();
  return res.items;
}

export async function listNamespaces(): Promise<V1Namespace[]> {
  const res = await coreApi().listNamespace();
  return res.items;
}

export async function listAllPods(): Promise<V1Pod[]> {
  const res = await coreApi().listPodForAllNamespaces();
  return res.items;
}

export async function listPods(namespace: string): Promise<V1Pod[]> {
  const res = await coreApi().listNamespacedPod({ namespace });
  return res.items;
}

export async function deletePod(namespace: string, name: string): Promise<void> {
  await coreApi().deleteNamespacedPod({ namespace, name });
}

export async function getPodLogs(
  namespace: string,
  name: string,
  container?: string,
  tailLines = 200,
): Promise<string> {
  return coreApi().readNamespacedPodLog({
    namespace,
    name,
    container,
    tailLines,
    timestamps: true,
  });
}

export async function listAllDeployments(): Promise<V1Deployment[]> {
  const res = await appsApi().listDeploymentForAllNamespaces();
  return res.items;
}

export async function scaleDeployment(
  namespace: string,
  name: string,
  replicas: number,
): Promise<void> {
  const api = appsApi();
  const scale = await api.readNamespacedDeploymentScale({ namespace, name });
  scale.spec = { ...scale.spec, replicas };
  await api.replaceNamespacedDeploymentScale({ namespace, name, body: scale });
}

/** Rolling restart : même mécanisme que `kubectl rollout restart`. */
export async function restartDeployment(
  namespace: string,
  name: string,
): Promise<void> {
  const api = appsApi();
  const dep = await api.readNamespacedDeployment({ namespace, name });
  const annotations = dep.spec?.template.metadata?.annotations ?? {};
  annotations["kubectl.kubernetes.io/restartedAt"] = new Date().toISOString();
  dep.spec!.template.metadata = {
    ...dep.spec!.template.metadata,
    annotations,
  };
  await api.replaceNamespacedDeployment({ namespace, name, body: dep });
}

export async function recentEvents(limit = 25): Promise<CoreV1Event[]> {
  const res = await coreApi().listEventForAllNamespaces();
  return res.items
    .sort((a, b) => {
      const ta = (a.lastTimestamp ?? a.eventTime ?? a.metadata.creationTimestamp ?? 0).valueOf();
      const tb = (b.lastTimestamp ?? b.eventTime ?? b.metadata.creationTimestamp ?? 0).valueOf();
      return tb > ta ? 1 : -1;
    })
    .slice(0, limit);
}

export async function nodeMetrics(): Promise<NodeMetric[]> {
  const res = await metricsClient().getNodeMetrics();
  return res.items;
}

export async function podMetrics(namespace?: string): Promise<PodMetric[]> {
  const res = namespace
    ? await metricsClient().getPodMetrics(namespace)
    : await metricsClient().getPodMetrics();
  return res.items;
}
