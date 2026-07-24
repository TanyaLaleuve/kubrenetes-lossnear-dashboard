import { PassThrough } from "node:stream";
import { Log } from "@kubernetes/client-node";
import { sessionUser } from "@/lib/auth/user";
import { coreApi, getKubeConfig } from "@/lib/k8s/client";
import { requireServerPermission } from "@/lib/servers/authz";
import { SERVERS_NAMESPACE } from "@/lib/servers/k8s";

/**
 * Console en Server-Sent Events, en deux phases dans la même connexion :
 * 1. pod absent ou en cours de démarrage : diffuse les événements Kubernetes
 *    (scheduling, téléchargement d'image, démarrage) pour donner du feedback ;
 * 2. conteneur démarré : bascule sur le flux de logs temps réel.
 * Si le flux se coupe (redémarrage, crash), on repasse en phase 1.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await sessionUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  let server;
  try {
    server = await requireServerPermission(user, id, "console.read");
  } catch {
    return new Response(null, { status: 403 });
  }

  const podName = `${server.slug}-0`;
  const core = coreApi();
  const logClient = new Log(getKubeConfig());
  const encoder = new TextEncoder();

  // Marqueur inséré au passage prépa -> logs serveur (rendu comme séparateur).
  const SEPARATOR = "SERVER_LOGS";

  // Séquences ANSI (couleurs, déplacements curseur) et caractères de contrôle.
  const ANSI = new RegExp(
    "\\x1b\\[[0-9;?]*[A-Za-z]|\\x1b\\][^\\x07]*\\x07|[\\x00-\\x08\\x0b-\\x1f]",
    "g",
  );
  // Nettoie une ligne de log : ne garde que la dernière frame d'une barre de
  // progression (réécrite via \r) puis retire l'ANSI et les caractères de
  // contrôle — sinon un \r casse le protocole SSE.
  const sanitizeLog = (raw: string): string => {
    const lastCr = raw.lastIndexOf("\r");
    const frame = lastCr >= 0 ? raw.slice(lastCr + 1) : raw;
    return frame.replace(ANSI, "");
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let activeLogAbort: AbortController | null = null;

      const send = (line: string) => {
        if (closed) return;
        try {
          // Garde-fou SSE : un \r ou \n résiduel briserait la trame data:.
          const safe = line.replace(/[\r\n]+/g, " ");
          controller.enqueue(encoder.encode(`data: ${safe}\n\n`));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        activeLogAbort?.abort();
        try {
          controller.close();
        } catch {
          // déjà fermé
        }
      };
      request.signal.addEventListener("abort", close);

      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      const seenEvents = new Set<string>();
      const emitPodEvents = async () => {
        try {
          const events = await core.listNamespacedEvent({
            namespace: SERVERS_NAMESPACE,
            fieldSelector: `involvedObject.name=${podName}`,
          });
          const sorted = events.items.sort((a, b) => {
            const ta = (a.lastTimestamp ?? a.eventTime ?? 0).valueOf();
            const tb = (b.lastTimestamp ?? b.eventTime ?? 0).valueOf();
            return ta > tb ? 1 : -1;
          });
          for (const event of sorted) {
            const key = `${event.metadata.uid}:${event.count ?? 0}`;
            if (seenEvents.has(key)) continue;
            seenEvents.add(key);
            send(`[système] ${event.reason} — ${event.message ?? ""}`);
          }
        } catch {
          // événements indisponibles : pas bloquant
        }
      };

      /** Suit les logs d'un conteneur jusqu'à coupure du flux. */
      const streamLogs = (container: string, prefix = "") =>
        new Promise<void>((resolve) => {
          const source = new PassThrough();
          let buffer = "";
          source.on("data", (chunk: Buffer) => {
            buffer += chunk.toString("utf8");
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) send(prefix + sanitizeLog(line));
          });
          const done = () => resolve();
          source.on("end", done);
          source.on("error", done);
          logClient
            .log(SERVERS_NAMESPACE, podName, container, source, {
              follow: true,
              tailLines: 150,
              timestamps: false,
            })
            .then((abort) => {
              activeLogAbort = abort;
            })
            .catch(done);
        });

      /** Vide d'un coup les logs d'un conteneur (post-mortem d'un échec). */
      const dumpLogs = async (container: string, prefix = "") => {
        try {
          const raw = await core.readNamespacedPodLog({
            namespace: SERVERS_NAMESPACE,
            name: podName,
            container,
            tailLines: 60,
          });
          for (const line of String(raw).split("\n")) {
            if (line.trim()) send(prefix + sanitizeLog(line));
          }
        } catch {
          send("[système] Logs d'installation indisponibles.");
        }
      };

      let waitingNotified = false;
      // Tentative d'installation déjà rapportée (indexée sur le restartCount) :
      // évite de reverser les mêmes logs à chaque tour de boucle.
      let installReported = -1;
      let installFollowed = -1;
      // Séparateur « logs serveur » déjà envoyé pour le run en cours.
      let separatorSent = false;

      while (!closed) {
        let pod = null;
        try {
          pod = await core.readNamespacedPod({
            namespace: SERVERS_NAMESPACE,
            name: podName,
          });
        } catch {
          // pod pas encore créé
        }

        if (!pod) {
          if (!waitingNotified) {
            send("[système] En attente de la création du pod…");
            waitingNotified = true;
          }
          await sleep(2500);
          continue;
        }
        waitingNotified = false;

        await emitPodEvents();

        // Phase d'installation (initContainer) : c'est là que se jouent les
        // téléchargements de l'egg. Sans ça, un échec n'apparaît que sous la
        // forme d'un « BackOff » opaque dans les événements Kubernetes.
        const install = pod.status?.initContainerStatuses?.find(
          (s) => s.name === "install",
        );
        if (install) {
          const attempt = install.restartCount ?? 0;
          const ended = install.state?.terminated ?? install.lastState?.terminated;

          if (install.state?.running) {
            if (installFollowed !== attempt) {
              installFollowed = attempt;
              send("[système] Installation en cours…");
            }
            // Suit l'install en direct : se termine quand le conteneur s'arrête.
            await streamLogs("install", "[install] ");
            activeLogAbort = null;
          } else if (ended && ended.exitCode !== 0 && installReported !== attempt) {
            installReported = attempt;
            send(
              `[système] ÉCHEC de l'installation (code ${ended.exitCode}${
                ended.reason ? `, ${ended.reason}` : ""
              }). Détail :`,
            );
            await dumpLogs("install", "[install] ");
            send(
              "[système] Le serveur ne démarrera pas tant que l'installation échoue. Corrige la configuration dans l'onglet Startup, enregistre, puis relance.",
            );
          } else if (ended && ended.exitCode === 0 && installReported !== attempt) {
            installReported = attempt;
            send("[système] Installation terminée.");
          }
        }

        const state = pod.status?.containerStatuses?.[0]?.state;
        if (state?.running) {
          // Séparateur envoyé une seule fois par run : le client vide la console
          // à ce signal, pour ne pas cumuler les logs des démarrages précédents.
          if (!separatorSent) {
            send(SEPARATOR);
            separatorSent = true;
          }
          await streamLogs("server");
          activeLogAbort = null;
          if (!closed) {
            send("[système] Flux de logs interrompu, reconnexion…");
          }
        } else {
          // Conteneur pas (plus) en cours : le prochain démarrage videra à nouveau.
          separatorSent = false;
        }
        await sleep(2000);
      }
    },
    cancel() {
      // close() déjà branché sur request.signal
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Désactive le buffering des deux nginx (hôte + ingress) : sans ça,
      // le flux SSE reste en tampon et rien n'atteint le navigateur.
      "X-Accel-Buffering": "no",
    },
  });
}
