import * as k8s from "@kubernetes/client-node";

/**
 * Client Kubernetes unique pour tout le process.
 * - En cluster : ServiceAccount monté automatiquement.
 * - En local (dev) : ~/.kube/config (contexte courant).
 */
let kubeConfig: k8s.KubeConfig | null = null;

export function getKubeConfig(): k8s.KubeConfig {
  if (!kubeConfig) {
    kubeConfig = new k8s.KubeConfig();
    if (process.env.KUBERNETES_SERVICE_HOST) {
      kubeConfig.loadFromCluster();
    } else {
      kubeConfig.loadFromDefault();
    }
  }
  return kubeConfig;
}

export function coreApi(): k8s.CoreV1Api {
  return getKubeConfig().makeApiClient(k8s.CoreV1Api);
}

export function appsApi(): k8s.AppsV1Api {
  return getKubeConfig().makeApiClient(k8s.AppsV1Api);
}

export function autoscalingApi(): k8s.AutoscalingV2Api {
  return getKubeConfig().makeApiClient(k8s.AutoscalingV2Api);
}

export function metricsClient(): k8s.Metrics {
  return new k8s.Metrics(getKubeConfig());
}
