#!/usr/bin/env bash
# Déploiement sur le VPS (single node) sans registre :
# build de l'image avec Docker puis import dans containerd (namespace k8s.io).
# Usage : bash deploy/deploy-on-vps.sh [ref-git]
#
# Tout le corps vit dans main() : bash parse la fonction entière avant de
# l'exécuter, ce qui évite qu'un `git checkout` modifiant CE fichier en cours
# de route ne fasse exécuter un mélange ancienne/nouvelle version.
set -euo pipefail

main() {
  local REF="${1:-main}"
  local REPO="https://github.com/TanyaLaleuve/kubrenetes-lossnear-dashboard.git"
  local DIR="/opt/lossnear/k8s-dashboard"
  local IMAGE="ghcr.io/tanyalaleuve/kubrenetes-lossnear-dashboard:latest"
  local AGENT_IMAGE="ghcr.io/tanyalaleuve/lossnear-agent:latest"
  export KUBECONFIG=/root/.kube/config

  if [ ! -d "$DIR/.git" ]; then
    mkdir -p "$(dirname "$DIR")"
    git clone "$REPO" "$DIR"
  fi
  git -C "$DIR" fetch origin
  git -C "$DIR" checkout -f "origin/$REF"

  echo "=== Secret token agent (créé une seule fois) ==="
  if ! kubectl -n lossnear-system get secret lossnear-agent-token >/dev/null 2>&1; then
    kubectl -n lossnear-system create secret generic lossnear-agent-token \
      --from-literal=AGENT_TOKEN="$(openssl rand -hex 32)"
  fi

  echo "=== Build images ==="
  docker build -t "$IMAGE" "$DIR"
  docker build -t "$AGENT_IMAGE" "$DIR/agent"

  echo "=== Import dans containerd (k8s.io) ==="
  docker save "$IMAGE" | ctr -n k8s.io images import -
  docker save "$AGENT_IMAGE" | ctr -n k8s.io images import -

  echo "=== Apply manifests ==="
  local manifest
  for manifest in "$DIR"/k8s/*.yaml; do
    [[ "$manifest" == *secret.example* ]] && continue
    kubectl apply -f "$manifest"
  done

  echo "=== Rollout ==="
  kubectl -n lossnear-system rollout restart deployment/k8s-dashboard
  kubectl -n lossnear-system rollout restart daemonset/lossnear-agent
  kubectl -n lossnear-system rollout status deployment/k8s-dashboard --timeout=180s
  kubectl -n lossnear-system rollout status daemonset/lossnear-agent --timeout=120s
  kubectl -n lossnear-system get pods

  exit 0
}

main "$@"
