# Agent de nœud lossnear (API fichiers HTTP + serveur SFTP).
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs sftp.mjs ./
USER node
EXPOSE 8080 2222
CMD ["node", "server.mjs"]
