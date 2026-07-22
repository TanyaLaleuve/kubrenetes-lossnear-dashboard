// Serveur SFTP de l'agent lossnear.
// Authentifie via le dashboard (login `utilisateur.serverId` + mot de passe),
// puis chroot chaque session sur le volume du serveur.
import {
  closeSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import { posix, resolve, sep } from "node:path";
import ssh2 from "ssh2";

const { Server } = ssh2;
const { OPEN_MODE, STATUS_CODE } = ssh2.utils.sftp;

/** Chemin réel sûr sous `base`, à partir d'un chemin client absolu. */
function mapClient(base, clientPath) {
  const norm = posix.normalize("/" + (clientPath || "")).replace(/^\/+/, "");
  const target = resolve(base, norm);
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error("chemin hors du volume");
  }
  return target;
}

/** Chemin client canonique (relatif à la racine chroot). */
function clientPathOf(base, target) {
  const rel = target === base ? "" : target.slice(base.length + 1);
  return "/" + rel.split(sep).join("/");
}

function statToAttrs(s) {
  return {
    mode: s.mode,
    uid: s.uid,
    gid: s.gid,
    size: s.size,
    atime: Math.floor(s.atimeMs / 1000),
    mtime: Math.floor(s.mtimeMs / 1000),
  };
}

function longname(name, s) {
  const dir = s.isDirectory() ? "d" : "-";
  const date = new Date(s.mtimeMs).toISOString().slice(0, 16).replace("T", " ");
  const size = String(s.size).padStart(10);
  return `${dir}rw-r--r-- 1 owner group ${size} ${date} ${name}`;
}

function handleSftp(sftp, base) {
  const handles = new Map();
  let counter = 0;
  const makeHandle = (state) => {
    const id = counter++;
    handles.set(id, state);
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(id, 0);
    return buf;
  };
  const getHandle = (buf) => handles.get(buf.readUInt32BE(0));

  sftp.on("REALPATH", (reqid, p) => {
    try {
      const target = mapClient(base, p);
      const canonical = clientPathOf(base, target);
      sftp.name(reqid, [{ filename: canonical, longname: canonical, attrs: {} }]);
    } catch {
      sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
    }
  });

  const doStat = (reqid, p) => {
    try {
      const s = statSync(mapClient(base, p));
      sftp.attrs(reqid, statToAttrs(s));
    } catch {
      sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
    }
  };
  sftp.on("STAT", doStat);
  sftp.on("LSTAT", doStat);

  sftp.on("FSTAT", (reqid, handle) => {
    const state = getHandle(handle);
    if (!state || state.type !== "file") return sftp.status(reqid, STATUS_CODE.FAILURE);
    try {
      sftp.attrs(reqid, statToAttrs(fstatSync(state.fd)));
    } catch {
      sftp.status(reqid, STATUS_CODE.FAILURE);
    }
  });

  sftp.on("OPENDIR", (reqid, p) => {
    try {
      const target = mapClient(base, p);
      statSync(target); // vérifie l'existence
      sftp.handle(reqid, makeHandle({ type: "dir", path: target, done: false }));
    } catch {
      sftp.status(reqid, STATUS_CODE.NO_SUCH_FILE);
    }
  });

  sftp.on("READDIR", (reqid, handle) => {
    const state = getHandle(handle);
    if (!state || state.type !== "dir") return sftp.status(reqid, STATUS_CODE.FAILURE);
    if (state.done) return sftp.status(reqid, STATUS_CODE.EOF);
    try {
      const names = readdirSync(state.path, { withFileTypes: true }).map((entry) => {
        let s;
        try {
          s = statSync(resolve(state.path, entry.name));
        } catch {
          s = { isDirectory: () => entry.isDirectory(), size: 0, mode: 0o644, uid: 0, gid: 0, atimeMs: 0, mtimeMs: 0 };
        }
        return {
          filename: entry.name,
          longname: longname(entry.name, s),
          attrs: statToAttrs(s),
        };
      });
      state.done = true;
      sftp.name(reqid, names);
    } catch {
      sftp.status(reqid, STATUS_CODE.FAILURE);
    }
  });

  sftp.on("OPEN", (reqid, filename, flags) => {
    try {
      const target = mapClient(base, filename);
      let mode = "r";
      if (flags & OPEN_MODE.WRITE && flags & OPEN_MODE.READ) mode = "r+";
      if (flags & OPEN_MODE.WRITE) mode = "w";
      if (flags & OPEN_MODE.APPEND) mode = "a";
      if (flags & OPEN_MODE.CREAT && !(flags & OPEN_MODE.WRITE)) mode = "w";
      const fd = openSync(target, mode);
      sftp.handle(reqid, makeHandle({ type: "file", fd, path: target }));
    } catch {
      sftp.status(reqid, STATUS_CODE.FAILURE);
    }
  });

  sftp.on("READ", (reqid, handle, offset, length) => {
    const state = getHandle(handle);
    if (!state || state.type !== "file") return sftp.status(reqid, STATUS_CODE.FAILURE);
    try {
      const buf = Buffer.alloc(length);
      const bytes = readSync(state.fd, buf, 0, length, offset);
      if (bytes === 0) return sftp.status(reqid, STATUS_CODE.EOF);
      sftp.data(reqid, buf.subarray(0, bytes));
    } catch {
      sftp.status(reqid, STATUS_CODE.FAILURE);
    }
  });

  sftp.on("WRITE", (reqid, handle, offset, data) => {
    const state = getHandle(handle);
    if (!state || state.type !== "file") return sftp.status(reqid, STATUS_CODE.FAILURE);
    try {
      writeSync(state.fd, data, 0, data.length, offset);
      sftp.status(reqid, STATUS_CODE.OK);
    } catch {
      sftp.status(reqid, STATUS_CODE.FAILURE);
    }
  });

  sftp.on("CLOSE", (reqid, handle) => {
    const id = handle.readUInt32BE(0);
    const state = handles.get(id);
    if (state?.type === "file") {
      try {
        closeSync(state.fd);
      } catch {
        // déjà fermé
      }
    }
    handles.delete(id);
    sftp.status(reqid, STATUS_CODE.OK);
  });

  const wrap = (reqid, fn) => {
    try {
      fn();
      sftp.status(reqid, STATUS_CODE.OK);
    } catch {
      sftp.status(reqid, STATUS_CODE.FAILURE);
    }
  };

  sftp.on("MKDIR", (reqid, p) =>
    wrap(reqid, () => mkdirSync(mapClient(base, p), { recursive: true })),
  );
  sftp.on("RMDIR", (reqid, p) =>
    wrap(reqid, () => rmdirSync(mapClient(base, p), { recursive: true })),
  );
  sftp.on("REMOVE", (reqid, p) =>
    wrap(reqid, () => unlinkSync(mapClient(base, p))),
  );
  sftp.on("RENAME", (reqid, oldPath, newPath) =>
    wrap(reqid, () => renameSync(mapClient(base, oldPath), mapClient(base, newPath))),
  );
  // Modifications de permissions/dates : acceptées sans effet (volume géré).
  sftp.on("SETSTAT", (reqid) => sftp.status(reqid, STATUS_CODE.OK));
  sftp.on("FSETSTAT", (reqid) => sftp.status(reqid, STATUS_CODE.OK));
}

export function startSftp({ port, hostKey, storageRoot, authUrl, agentToken }) {
  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    let vol = null;

    client.on("authentication", async (ctx) => {
      if (ctx.method !== "password") return ctx.reject(["password"]);
      const idx = ctx.username.lastIndexOf(".");
      if (idx < 1) return ctx.reject();
      const username = ctx.username.slice(0, idx);
      const serverId = ctx.username.slice(idx + 1);
      try {
        const res = await fetch(authUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${agentToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password: ctx.password, serverId }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok && body.ok && body.vol) {
          vol = body.vol;
          return ctx.accept();
        }
      } catch {
        // dashboard injoignable
      }
      ctx.reject();
    });

    client.on("ready", () => {
      client.on("session", (accept) => {
        const session = accept();
        session.on("sftp", (acceptSftp) => {
          const sftp = acceptSftp();
          try {
            handleSftp(sftp, resolve(storageRoot, vol));
          } catch (error) {
            console.error("[sftp] session:", error);
          }
        });
      });
    });

    client.on("error", () => {
      // erreurs réseau/protocole : ignorées (le client se reconnecte)
    });
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`[sftp] écoute sur :${port}`);
  });
}
