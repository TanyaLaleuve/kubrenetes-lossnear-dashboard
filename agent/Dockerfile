# Agent de nœud lossnear (API fichiers HTTP + serveur SFTP).
FROM node:24-alpine
# zip/unzip pour la compression/décompression (tar+gzip sont dans busybox).
RUN apk add --no-cache zip unzip
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs sftp.mjs ./
# Tourne en root : agent de gestion de fichiers, doit lire/écrire les données
# de tous les serveurs (propriétaires uid variés) sur le stockage du nœud.
EXPOSE 8080 2222
CMD ["node", "server.mjs"]
