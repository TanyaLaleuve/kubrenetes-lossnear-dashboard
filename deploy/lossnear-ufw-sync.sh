#!/usr/bin/env bash
# Synchronise les règles ufw avec les ports des serveurs lossnear.
#
# Principe : le dashboard expose la liste des ports attribués sur
# /api/internal/ports (protégée par AGENT_TOKEN). Ce script ouvre les ports
# manquants et ferme ceux qui ont disparu.
#
# Sécurité : on ne touche QUE les règles portant le commentaire
# "lossnear-auto". Toutes les autres règles (SSH, nginx, bases de données,
# Pterodactyl, plage 25600-25699 historique…) sont laissées intactes.
set -euo pipefail

COMMENT="lossnear-auto"
NAMESPACE="lossnear-system"
export KUBECONFIG=${KUBECONFIG:-/root/.kube/config}

# Token partagé avec le dashboard (lu depuis le secret Kubernetes).
TOKEN="$(kubectl -n "$NAMESPACE" get secret lossnear-agent-token \
  -o jsonpath='{.data.AGENT_TOKEN}' | base64 -d)"
if [ -z "$TOKEN" ]; then
  echo "AGENT_TOKEN introuvable" >&2
  exit 1
fi

# Ports souhaités (un par ligne) via l'ingress local (NodePort 30080).
DESIRED="$(curl -sf --max-time 10 \
  -H "Host: k8s.lossnear.com" \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:30080/api/internal/ports || true)"

# Un échec de l'API ne doit jamais fermer des ports (sinon coupure de service
# à chaque redémarrage du dashboard) : on sort sans rien changer.
if [ -z "$DESIRED" ]; then
  echo "Liste des ports indisponible — aucune modification."
  exit 0
fi

# Ports actuellement ouverts par NOUS (règles commentées lossnear-auto).
CURRENT="$(ufw status | grep -F "# $COMMENT" | awk '{print $1}' \
  | cut -d/ -f1 | sort -un || true)"

# Ouvrir ce qui manque.
for port in $DESIRED; do
  case "$port" in ''|*[!0-9]*) continue ;; esac
  if ! grep -qx "$port" <<<"$CURRENT"; then
    echo "ouverture du port $port"
    ufw allow "$port/tcp" comment "$COMMENT" >/dev/null
  fi
done

# Fermer ce qui n'est plus utilisé (uniquement nos règles).
for port in $CURRENT; do
  if ! grep -qx "$port" <<<"$DESIRED"; then
    echo "fermeture du port $port"
    ufw --force delete allow "$port/tcp" >/dev/null || true
  fi
done
