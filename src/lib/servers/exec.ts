import "server-only";
import { PassThrough, Readable, Writable } from "node:stream";
import { Attach, Exec } from "@kubernetes/client-node";
import { getKubeConfig } from "@/lib/k8s/client";
import { SERVERS_NAMESPACE } from "./k8s";

/**
 * Envoie une commande sur le stdin du process principal du conteneur (équivaut
 * à taper dans la console). Même mécanisme que l'endpoint /command.
 */
export async function sendConsoleCommand(
  slug: string,
  command: string,
): Promise<void> {
  const attach = new Attach(getKubeConfig());
  const stdin = new Readable({ read() {} });
  const devNull = new Writable({ write: (_c, _e, cb) => cb() });
  const ws = await attach.attach(
    SERVERS_NAMESPACE,
    `${slug}-0`,
    "server",
    devNull,
    devNull,
    stdin,
    false,
  );
  stdin.push(command + "\n");
  await new Promise((resolve) => setTimeout(resolve, 400));
  stdin.push(null);
  ws.close();
}

export type ExecResult = { stdout: string; stderr: string; exitCode: number };

/**
 * Exécute une commande shell DANS le conteneur `server` du pod d'un serveur
 * (équivalent `kubectl exec`). Reste confiné à ce conteneur, qui est déjà en
 * bac à sable : uid non-root, aucune capability, réseau cloisonné, aucun droit
 * sur l'API Kubernetes. Ne fonctionne que si le serveur tourne (pod présent).
 */
export async function execInServer(
  slug: string,
  command: string,
  timeoutMs = 60_000,
): Promise<ExecResult> {
  const exec = new Exec(getKubeConfig());
  const stdout = new BufferSink();
  const stderr = new BufferSink();

  return new Promise<ExecResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Commande interrompue (délai dépassé)."));
    }, timeoutMs);

    exec
      .exec(
        SERVERS_NAMESPACE,
        `${slug}-0`,
        "server",
        ["/bin/sh", "-c", command],
        stdout as unknown as Writable,
        stderr as unknown as Writable,
        null,
        false,
        (status) => {
          clearTimeout(timer);
          // status.status === "Success" -> code 0 ; sinon on lit le code renvoyé.
          const code =
            status?.status === "Success"
              ? 0
              : Number(
                  status?.details?.causes?.find((c) => c.reason === "ExitCode")
                    ?.message ?? 1,
                );
          resolve({
            stdout: stdout.text(),
            stderr: stderr.text(),
            exitCode: Number.isFinite(code) ? code : 1,
          });
        },
      )
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** Petit puits mémoire : accumule les octets écrits, plafonné pour la sûreté. */
class BufferSink extends PassThrough {
  private chunks: Buffer[] = [];
  private size = 0;
  private readonly max = 256 * 1024; // 256 Kio de sortie max

  constructor() {
    super();
    this.on("data", (chunk: Buffer) => {
      if (this.size >= this.max) return;
      this.size += chunk.length;
      this.chunks.push(chunk);
    });
  }

  text(): string {
    const out = Buffer.concat(this.chunks).toString("utf8");
    return this.size >= this.max ? out + "\n…(sortie tronquée)" : out;
  }
}
