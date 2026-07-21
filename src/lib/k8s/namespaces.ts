/**
 * Namespaces techniques du cluster (infrastructure Kubernetes elle-même).
 * Les pages principales du dashboard n'affichent que les applications
 * lossnear ; tout le reste vit sur la page "Système".
 */
const SYSTEM_NAMESPACES = new Set([
  "kube-system",
  "kube-public",
  "kube-node-lease",
  "calico-system",
  "calico-apiserver",
  "tigera-operator",
  "ingress-nginx",
  "local-path-storage",
]);

export function isSystemNamespace(namespace: string | undefined): boolean {
  return namespace !== undefined && SYSTEM_NAMESPACES.has(namespace);
}
