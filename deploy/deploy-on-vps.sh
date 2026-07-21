#!/usr/bin/env bash
# Déploiement sur le VPS (single node) sans registre :
# build de l'image avec Docker puis import dans containerd (namespace k8s.io).
# Usage : bash deploy/deploy-on-vps.sh [ref-git]
set -euo pipefail

REF="${1:-main}"
REPO="https://github.com/TanyaLaleuve/kubrenetes-lossnear-dashboard.git"
DIR="/opt/lossnear/k8s-dashboard"
IMAGE="ghcr.io/tanyalaleuve/kubrenetes-lossnear-dashboard:latest"
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
kubectl apply -f "$DIR/k8s/namespace.yaml"
kubectl apply -f "$DIR/k8s/rbac.yaml"
kubectl apply -f "$DIR/k8s/deployment.yaml"
kubectl apply -f "$DIR/k8s/ingress.yaml"

echo "=== Rollout ==="
kubectl -n lossnear-system rollout restart deployment/k8s-dashboard
kubectl -n lossnear-system rollout status deployment/k8s-dashboard --timeout=180s
kubectl -n lossnear-system get pods
