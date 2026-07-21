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
  export KUBECONFIG=/root/.kube/config

  if [ ! -d "$DIR/.git" ]; then
    mkdir -p "$(dirname "$DIR")"
    git clone "$REPO" "$DIR"
  fi
  git -C "$DIR" fetch origin
  git -C "$DIR" checkout -f "origin/$REF"

  echo "=== Build image ==="
  docker build -t "$IMAGE" "$DIR"

  echo "=== Import dans containerd (k8s.io) ==="
  docker save "$IMAGE" | ctr -n k8s.io images import -

  echo "=== Apply manifests ==="
  local manifest
  for manifest in "$DIR"/k8s/*.yaml; do
    [[ "$manifest" == *secret.example* ]] && continue
    kubectl apply -f "$manifest"
  done

  echo "=== Rollout ==="
  kubectl -n lossnear-system rollout restart deployment/k8s-dashboard
  kubectl -n lossnear-system rollout status deployment/k8s-dashboard --timeout=180s
  kubectl -n lossnear-system get pods

  exit 0
}

main "$@"
