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
  statfs,
} from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { generateKeyPairSync, timingSafeEqual } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { startSftp } from "./sftp.mjs";

const execFileAsync = promisify(execFile);

const STORAGE_ROOT = process.env.STORAGE_ROOT || "/data-root";
// Racine des archives de sauvegarde, sur un chemin dédié du nœud (hostPath).
const BACKUP_ROOT = process.env.BACKUP_ROOT || "/backups";
// Marge de sécurité : refuse un backup si l'espace libre du nœud passerait
// sous ce seuil, pour qu'un backup ne puisse jamais remplir le disque (et
// entraîner etcd, les serveurs et Pterodactyl avec lui).
const BACKUP_MIN_FREE_BYTES = Number(
  process.env.BACKUP_MIN_FREE_BYTES || 20 * 1024 ** 3,
);
const TOKEN = process.env.AGENT_TOKEN || "";
const PORT = Number(process.env.PORT || 8080);
const SFTP_PORT = Number(process.env.SFTP_PORT || 2222);
const SFTP_AUTH_URL =
  process.env.SFTP_AUTH_URL ||
  "http://k8s-dashboard.lossnear-system.svc.cluster.local/api/internal/sftp-auth";
const MAX_EDIT_BYTES = 2 * 1024 * 1024; // fichiers texte éditables : 2 Mo

if (!TOKEN) {
  console.error("AGENT_TOKEN manquant");
  process.exit(1);
}

// Racine des backups créée au démarrage (hostPath monté vide au 1er boot).
try {
  mkdirSync(BACKUP_ROOT, { recursive: true });
} catch {
  // droit/point de montage : les routes backup échoueront proprement sinon
}

/** Host key SSH persistante sur le disque du nœud (stable entre redémarrages). */
function loadHostKey() {
  const dir = join(STORAGE_ROOT, ".lossnear-agent");
  const keyPath = join(dir, "sftp_host_rsa");
  if (existsSync(keyPath)) return readFileSync(keyPath);
  mkdirSync(dir, { recursive: true });
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
  });
  writeFileSync(keyPath, privateKey, { mode: 0o600 });
  return Buffer.from(privateKey);
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
      let ctime = 0;
      try {
        const s = await stat(full);
        size = s.size;
        mtime = s.mtimeMs;
        // birthtime = date de création (crtime ext4) ; 0 si non supporté.
        ctime = s.birthtimeMs || 0;
      } catch {
        // lien cassé, etc.
      }
      return {
        name: entry.name,
        dir: entry.isDirectory(),
        size,
        mtime,
        ctime,
      };
    }),
  );
  items.sort((a, b) =>
    a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1,
  );
  return items;
}

/**
 * Occupation disque par volume. `local-path` n'applique AUCUN quota : la taille
 * du PVC est décorative, un serveur peut remplir la partition du nœud (et donc
 * casser etcd et les voisins). On mesure donc l'usage réel ici pour que le
 * dashboard puisse afficher et faire respecter les quotas.
 *
 * `du` est coûteux sur de gros volumes : le résultat est mis en cache et
 * recalculé au plus une fois par intervalle.
 */
const DISK_CACHE_MS = Number(process.env.DISK_CACHE_MS || 60_000);
let diskCache = { at: 0, volumes: {} };
let diskScanning = null;

async function scanDiskUsage() {
  const volumes = {};
  let entries = [];
  try {
    entries = await readdir(STORAGE_ROOT, { withFileTypes: true });
  } catch {
    return volumes;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    try {
      // -s : total du dossier, -k : en kibioctets (busybox n'a pas -b).
      const { stdout } = await execFileAsync(
        "du",
        ["-sk", join(STORAGE_ROOT, entry.name)],
        { timeout: 120_000, maxBuffer: 1 << 20 },
      );
      const kb = Number.parseInt(stdout.trim().split(/\s+/)[0], 10);
      if (Number.isFinite(kb)) volumes[entry.name] = kb * 1024;
    } catch {
      // volume illisible / disparu en cours de scan : on l'ignore
    }
  }
  return volumes;
}

async function diskUsage() {
  if (Date.now() - diskCache.at < DISK_CACHE_MS) return diskCache;
  // Un seul scan à la fois, même si plusieurs requêtes arrivent ensemble.
  if (!diskScanning) {
    diskScanning = scanDiskUsage()
      .then((volumes) => {
        diskCache = { at: Date.now(), volumes };
        return diskCache;
      })
      .finally(() => {
        diskScanning = null;
      });
  }
  return diskScanning;
}

// ---- Sauvegardes (archives tar.gz du volume d'un serveur) ----

/** Slug DNS-safe : sert de nom de dossier/fichier, à valider strictement. */
function safeSlug(slug) {
  if (!slug || !/^[a-z0-9-]{1,63}$/.test(slug)) throw new Error("slug invalide");
  return slug;
}

/** Identifiant de backup (UUID) : nom de fichier de l'archive. */
function safeBackupId(id) {
  if (!id || !/^[a-z0-9-]{1,64}$/i.test(id)) throw new Error("id invalide");
  return id;
}

function backupPath(slug, id) {
  return join(BACKUP_ROOT, safeSlug(slug), `${safeBackupId(id)}.tar.gz`);
}

/** Espace disque libre (octets) sur le système de fichiers des backups. */
async function freeBytes() {
  try {
    const s = await statfs(BACKUP_ROOT);
    return s.bavail * s.bsize;
  } catch {
    return Number.POSITIVE_INFINITY; // en cas de doute, on ne bloque pas
  }
}

/** Total occupé par les archives de backup (octets). */
async function backupsUsage() {
  try {
    const { stdout } = await execFileAsync("du", ["-sk", BACKUP_ROOT], {
      timeout: 120_000,
      maxBuffer: 1 << 20,
    });
    const kb = Number.parseInt(stdout.trim().split(/\s+/)[0], 10);
    return Number.isFinite(kb) ? kb * 1024 : 0;
  } catch {
    return 0;
  }
}

/**
 * Crée une archive tar.gz du volume `vol` sous BACKUP_ROOT/<slug>/<id>.tar.gz.
 * Le serveur est censé être arrêté (cohérence) : l'agent ne gère que le disque.
 */
async function createBackup(vol, slug, id) {
  const { base } = safePath(vol, "");
  const free = await freeBytes();
  if (free < BACKUP_MIN_FREE_BYTES) {
    const err = new Error("espace disque insuffisant pour créer une sauvegarde");
    err.status = 507;
    throw err;
  }
  const out = backupPath(slug, id);
  await mkdir(dirname(out), { recursive: true });
  // -C base . : archive le contenu du volume (pas le dossier parent).
  await execFileAsync("tar", ["-czf", out, "-C", base, "."], {
    timeout: 30 * 60_000,
    maxBuffer: 1 << 20,
  });
  const s = await stat(out);
  return s.size;
}

/**
 * Restaure une archive dans le volume : on vide le volume puis on ré-extrait.
 * Destructif — l'appelant (dashboard) confirme et arrête le serveur avant.
 */
async function restoreBackup(vol, slug, id) {
  const { base } = safePath(vol, "");
  const archive = backupPath(slug, id);
  await stat(archive); // 404 si absente
  // Vide le volume sans supprimer le point de montage lui-même.
  for (const entry of await readdir(base)) {
    await rm(join(base, entry), { recursive: true, force: true });
  }
  await execFileAsync("tar", ["-xzf", archive, "-C", base], {
    timeout: 30 * 60_000,
    maxBuffer: 1 << 20,
  });
}

async function deleteBackup(slug, id) {
  await rm(backupPath(slug, id), { force: true });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://agent");
    const route = url.pathname;

    // Sonde de santé : pas d'authentification (probe kubelet).
    if (route === "/healthz") return json(res, 200, { ok: true });

    if (!authorized(req)) return json(res, 401, { error: "non autorisé" });

    // Usage disque : pas de volume ciblé, doit passer avant safePath().
    if (req.method === "GET" && route === "/disk/usage") {
      const { at, volumes } = await diskUsage();
      return json(res, 200, { scannedAt: at, volumes });
    }

    // Espace des backups : pas de volume ciblé non plus.
    if (req.method === "GET" && route === "/backup/usage") {
      const [used, free] = await Promise.all([backupsUsage(), freeBytes()]);
      return json(res, 200, { used, free, minFree: BACKUP_MIN_FREE_BYTES });
    }

    // Suppression d'un backup : ne cible pas un volume, juste slug + id.
    if (req.method === "POST" && route === "/backup/delete") {
      const slug = url.searchParams.get("slug") || "";
      const id = url.searchParams.get("id") || "";
      await deleteBackup(slug, id);
      return json(res, 200, { ok: true });
    }

    // Téléchargement d'une archive de backup (admin, hors volume).
    if (req.method === "GET" && route === "/backup/download") {
      const slug = url.searchParams.get("slug") || "";
      const id = url.searchParams.get("id") || "";
      const path = backupPath(slug, id);
      await stat(path);
      res.writeHead(200, {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${safeSlug(slug)}-${safeBackupId(id)}.tar.gz"`,
      });
      await pipeline(createReadStream(path), res);
      return;
    }

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

    // Téléchargement d'une URL directement dans le volume (tâche planifiée
    // « mise à jour »). Marche même serveur éteint. URL http/https uniquement.
    if (req.method === "POST" && route === "/files/fetch") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const url = String(body.url || "");
      if (!/^https?:\/\//i.test(url)) {
        return json(res, 400, { error: "URL invalide (http/https attendu)" });
      }
      const upstream = await fetch(url, { redirect: "follow" });
      if (!upstream.ok || !upstream.body) {
        return json(res, 502, { error: `Téléchargement échoué (HTTP ${upstream.status})` });
      }
      await mkdir(dirname(target), { recursive: true });
      const { Readable } = await import("node:stream");
      await pipeline(Readable.fromWeb(upstream.body), createWriteStream(target));
      const s = await stat(target);
      return json(res, 200, { ok: true, size: s.size });
    }

    // Compression d'une sélection en une archive dans le volume.
    if (req.method === "POST" && route === "/archive/compress") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const rels = Array.isArray(body.paths) ? body.paths.slice(0, 5000) : [];
      const format = body.format === "zip" ? "zip" : "targz";
      const { base } = safePath(vol, "");
      const { target: dest } = safePath(vol, String(body.dest || ""));
      // Chaque entrée doit rester dans le volume ; on passe des chemins relatifs.
      const items = [];
      for (const r of rels) {
        safePath(vol, r); // rejette une évasion
        items.push(r.replace(/^[/\\]+/, ""));
      }
      if (items.length === 0) return json(res, 400, { error: "aucun fichier" });
      if (format === "zip") {
        await execFileAsync("zip", ["-r", "-q", dest, ...items], {
          cwd: base,
          timeout: 30 * 60_000,
          maxBuffer: 1 << 20,
        });
      } else {
        await execFileAsync("tar", ["-czf", dest, "-C", base, ...items], {
          timeout: 30 * 60_000,
          maxBuffer: 1 << 20,
        });
      }
      const s = await stat(dest);
      return json(res, 200, { ok: true, size: s.size });
    }

    // Extraction d'une archive (`vol`+`path`) dans un dossier de destination.
    if (req.method === "POST" && route === "/archive/extract") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const { target: archive } = safePath(vol, rel);
      const { target: destDir } = safePath(vol, String(body.dest || ""));
      await mkdir(destDir, { recursive: true });
      const low = archive.toLowerCase();
      if (low.endsWith(".zip")) {
        await execFileAsync("unzip", ["-o", "-q", archive, "-d", destDir], {
          timeout: 30 * 60_000, maxBuffer: 1 << 20,
        });
      } else if (low.endsWith(".tar.gz") || low.endsWith(".tgz")) {
        await execFileAsync("tar", ["-xzf", archive, "-C", destDir], {
          timeout: 30 * 60_000, maxBuffer: 1 << 20,
        });
      } else if (low.endsWith(".tar")) {
        await execFileAsync("tar", ["-xf", archive, "-C", destDir], {
          timeout: 30 * 60_000, maxBuffer: 1 << 20,
        });
      } else if (low.endsWith(".gz")) {
        // .gz simple (un seul fichier) : décompresse en retirant l'extension.
        await execFileAsync("sh", ["-c", `gunzip -kf "${archive}"`], {
          timeout: 30 * 60_000, maxBuffer: 1 << 20,
        });
      } else {
        return json(res, 400, {
          error: "Format non pris en charge (zip, tar.gz, tar, gz).",
        });
      }
      return json(res, 200, { ok: true });
    }

    // Flux d'archive d'une sélection (téléchargement groupé, sans fichier temp).
    if (req.method === "POST" && route === "/archive/stream") {
      const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
      const rels = Array.isArray(body.paths) ? body.paths.slice(0, 5000) : [];
      const { base } = safePath(vol, "");
      const items = [];
      for (const r of rels) {
        safePath(vol, r);
        items.push(r.replace(/^[/\\]+/, ""));
      }
      if (items.length === 0) return json(res, 400, { error: "aucun fichier" });
      res.writeHead(200, { "Content-Type": "application/gzip" });
      const tar = spawn("tar", ["-czf", "-", "-C", base, ...items]);
      tar.stdout.pipe(res);
      tar.stderr.resume();
      tar.on("error", () => res.destroy());
      return;
    }

    // Création d'un backup : archive le volume `vol` (serveur arrêté en amont).
    if (req.method === "POST" && route === "/backup/create") {
      const slug = url.searchParams.get("slug") || "";
      const id = url.searchParams.get("id") || "";
      const size = await createBackup(vol, slug, id);
      return json(res, 200, { ok: true, size });
    }

    // Restauration : ré-extrait l'archive dans le volume (destructif).
    if (req.method === "POST" && route === "/backup/restore") {
      const slug = url.searchParams.get("slug") || "";
      const id = url.searchParams.get("id") || "";
      await restoreBackup(vol, slug, id);
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: "route inconnue" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      (error && typeof error === "object" && error.status) ||
      (message.includes("ENOENT") ? 404 : 400);
    json(res, status, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`[agent] écoute sur :${PORT}, racine ${STORAGE_ROOT}`);
});

// Serveur SFTP (accès fichiers par client SFTP, auth déléguée au dashboard).
startSftp({
  port: SFTP_PORT,
  hostKey: loadHostKey(),
  storageRoot: STORAGE_ROOT,
  authUrl: SFTP_AUTH_URL,
  agentToken: TOKEN,
});
