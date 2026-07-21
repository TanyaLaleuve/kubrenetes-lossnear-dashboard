# Lossnear — Dashboard Kubernetes

Dashboard d'administration du cluster Kubernetes lossnear. Mobile-first, thème sombre.
Base de l'écosystème lossnear : les futurs sous-dashboards (Minecraft, bot Discord)
s'appuieront sur le même socle.

Accessible sur https://k8s.lossnear.com (auth obligatoire).

## Stack

- **Next.js 16** (App Router, server components, server actions) + TypeScript
- **Tailwind CSS 4** — design tokens dans `src/app/globals.css`
- **@kubernetes/client-node** — accès API cluster côté serveur uniquement
- **iron-session + bcryptjs** — session chiffrée en cookie, login admin unique
- Icônes **lucide-react**

## Architecture

```
src/
  lib/
    env.ts             # Validation zod des variables d'environnement
    auth/
      session.ts       # Session iron-session + garde requireSession()
      actions.ts       # Server actions login/logout + anti brute-force
    k8s/
      client.ts        # KubeConfig (in-cluster ou ~/.kube/config en dev)
      resources.ts     # Lectures/mutations typées de l'API Kubernetes
      actions.ts       # Server actions mutations (auth vérifiée)
      format.ts        # Parsing CPU/mémoire, statuts pods, âges
  app/
    login/             # Page de connexion (publique)
    (protected)/       # Tout le reste — layout garde la session
      page.tsx         # Vue d'ensemble (métriques nœuds, stats, événements)
      pods/            # Liste, suppression, logs
      workloads/       # Deployments : scaling manuel, rolling restart
      nodes/           # Détail nœuds + usage CPU/RAM
      namespaces/
k8s/                   # Manifests de déploiement (RBAC dédié à droits limités)
deploy/deploy-on-vps.sh# Build + import containerd + kubectl apply (single node)
```

Sécurité : le pod tourne avec un ServiceAccount dédié dont le ClusterRole ne
couvre que ce que l'UI propose (pas de cluster-admin). Les identifiants du
dashboard vivent dans le Secret `k8s-dashboard-env`, jamais dans le code.

## Développement local

```bash
cp .env.example .env.local   # remplir SESSION_SECRET / ADMIN_USER / ADMIN_PASSWORD_HASH
node scripts/hash-password.mjs "monMotDePasse"   # → ADMIN_PASSWORD_HASH
npm install
npm run dev
```

En local le client Kubernetes utilise `~/.kube/config` (contexte courant).
En cluster il bascule automatiquement sur le ServiceAccount monté.

## Déploiement

1. Créer le secret (une fois) :

   ```bash
   kubectl -n lossnear-system create secret generic k8s-dashboard-env \
     --from-literal=SESSION_SECRET="$(openssl rand -base64 48)" \
     --from-literal=ADMIN_USER="admin" \
     --from-literal=ADMIN_PASSWORD_HASH='<hash bcrypt>'
   ```

2. Depuis le VPS :

   ```bash
   bash deploy/deploy-on-vps.sh
   ```

Le CI (`.github/workflows/ci.yml`) lint + build à chaque push et publie
l'image sur GHCR depuis `main` (utilisable plus tard pour du pull direct
multi-nœuds à la place de l'import containerd local).
