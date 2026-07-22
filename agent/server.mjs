#!/usr/bin/env node
// Agent de nœud lossnear (« mini-Wings ».)
// Sert une API HTTP de gestion de fichiers directement sur le stockage
// local-path du nœud, donc accessible même quand le serveur de jeu est éteint.
//
// Sécurité :
// - Toutes les requêtes exigent l'en-tête Authorization: Bearer <AGENT_TOKEN>.
// - Chaque opération est confinée sous STORAGE_ROOT/<vol> ; toute tentative de
//   sortie (..) est rejetée.
// - N'écoute qu'en ClusterIP interne (jamais exposé publiquement).
import { createServer } from "node:http";
import {
  createReadStream,
  createWriteStream,
} from "node:fs";
import {
  mkdir,
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { timingSafeEqual } from "node:crypto";

const STORAGE_ROOT = process.env.STORAGE_ROOT || "/data-root";
const TOKEN = process.env.AGENT_TOKEN || "";
const PORT = Number(process.env.PORT || 8080);
const MAX_EDIT_BYTES = 2 * 1024 * 1024; // fichiers texte éditables : 2 Mo

if (!TOKEN) {
  console.error("AGENT_TOKEN manquant");
  process.exit(1);
}

function authorized(req) {
  const header = req.headers["authorization"] || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(provided);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Résout un chemin sûr sous STORAGE_ROOT/<vol>, rejette toute évasion. */
function safePath(vol, rel) {
  if (!vol || /[\/\\]/.test(vol) || vol === "." || vol === "..") {
    throw new Error("volume invalide");
  }
  const base = resolve(STORAGE_ROOT, vol);
  const target = resolve(base, normalize("." + sep + (rel || "")));
  const within = target === base || target.startsWith(base + sep);
  if (!within) throw new Error("chemin hors du volume");
  return { base, target };
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function listDir(target) {
  const entries = await readdir(target, { withFileTypes: true });
  const items = await Promise.all(
    entries.map(async (entry) => {
      const full = join(target, entry.name);
      let size = 0;
      let mtime = 0;
      try {
        const s = await stat(full);
        size = s.size;
        mtime = s.mtimeMs;
      } catch {
        // lien cassé, etc.
      }
      return {
        name: entry.name,
        dir: entry.isDirectory(),
        size,
        mtime,
      };
    }),
  );
  items.sort((a, b) =>
    a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1,
  );
  return items;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://agent");
    const route = url.pathname;

    // Sonde de santé : pas d'authentification (probe kubelet).
    if (route === "/healthz") return json(res, 200, { ok: true });

    if (!authorized(req)) return json(res, 401, { error: "non autorisé" });

    const vol = url.searchParams.get("vol") || "";
    const rel = url.searchParams.get("path") || "";

    const { target } = safePath(vol, rel);

    if (req.method === "GET" && route === "/files/list") {
      const items = await listDir(target);
      return json(res, 200, { items });
    }

    if (req.method === "GET" && route === "/files/read") {
      const s = await stat(target);
      if (s.isDirectory()) return json(res, 400, { error: "c'est un dossier" });
      if (s.size > MAX_EDIT_BYTES)
        return json(res, 413, { error: "fichier trop gros pour l'éditeur" });
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      await pipeline(createReadStream(target), res);
      return;
    }

    if (req.method === "GET" && route === "/files/download") {
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment",
      });
      await pipeline(createReadStream(target), res);
      return;
    }

    if (req.method === "POST" && route === "/files/write") {
      await mkdir(dirname(target), { recursive: true });
      await pipeline(req, createWriteStream(target));
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && route === "/files/upload") {
      await mkdir(dirname(target), { recursive: true });
      await pipeline(req, createWriteStream(target));
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && route === "/files/mkdir") {
      await mkdir(target, { recursive: true });
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && route === "/files/delete") {
      await rm(target, { recursive: true, force: true });
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && route === "/files/rename") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const { target: dest } = safePath(vol, body.to || "");
      await mkdir(dirname(dest), { recursive: true });
      await rename(target, dest);
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: "route inconnue" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("ENOENT") ? 404 : 400;
    json(res, status, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`[agent] écoute sur :${PORT}, racine ${STORAGE_ROOT}`);
});
