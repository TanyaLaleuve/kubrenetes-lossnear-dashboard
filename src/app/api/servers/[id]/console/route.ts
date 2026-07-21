import { PassThrough } from "node:stream";
import { Log } from "@kubernetes/client-node";
import { sessionUser } from "@/lib/auth/user";
import { getKubeConfig } from "@/lib/k8s/client";
import { loadServerFor } from "@/lib/servers/authz";
import { SERVERS_NAMESPACE } from "@/lib/servers/k8s";

/**
 * Flux console en Server-Sent Events : suit les logs du pod en continu
 * (100 dernières lignes puis temps réel).
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
    server = await loadServerFor(user, id);
  } catch {
    return new Response(null, { status: 404 });
  }

  const podName = `${server.slug}-0`;
  const logClient = new Log(getKubeConfig());
  const source = new PassThrough();

  let abortController: AbortController;
  try {
    abortController = await logClient.log(
      SERVERS_NAMESPACE,
      podName,
      "server",
      source,
      { follow: true, tailLines: 100, timestamps: false },
    );
  } catch {
    return new Response(
      `data: [console] serveur arrêté ou pod indisponible\n\n`,
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let buffer = "";
      source.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          controller.enqueue(encoder.encode(`data: ${line}\n\n`));
        }
      });
      const close = () => {
        try {
          controller.close();
        } catch {
          // déjà fermé
        }
      };
      source.on("end", close);
      source.on("error", close);
      request.signal.addEventListener("abort", () => {
        abortController.abort();
        close();
      });
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
