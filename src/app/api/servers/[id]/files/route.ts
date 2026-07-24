import { NextResponse } from "next/server";
import { sessionUser, type SafeUser } from "@/lib/auth/user";
import { logActivity } from "@/lib/servers/activity";
import { agentFetch, serverVolumeFor } from "@/lib/servers/files";
import type { Permission } from "@/lib/servers/permissions";

async function resolve(id: string, permission: Permission) {
  const user = await sessionUser();
  if (!user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  try {
    const { vol, server } = await serverVolumeFor(user, id, permission);
    return { vol, user, server };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    const status = msg === "Accès refusé" ? 403 : 404;
    return { error: NextResponse.json({ error: msg }, { status }) };
  }
}

/** Journalise une opération fichier réussie (best-effort). */
function logFile(
  user: SafeUser,
  serverId: string,
  action: string,
  detail: string,
) {
  void logActivity({ serverId, actor: user, action, detail });
}

// GET : liste d'un dossier (défaut), contenu brut (?raw=1) ou téléchargement (?download=1).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { vol, user, server, error } = await resolve(id, "files.read");
  if (error) return error;

  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";

  if (url.searchParams.get("raw") === "1") {
    const res = await agentFetch("/files/read", vol!, path);
    if (!res.ok) return new NextResponse(await res.text(), { status: res.status });
    return new NextResponse(res.body, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (url.searchParams.get("download") === "1") {
    const res = await agentFetch("/files/download", vol!, path);
    if (!res.ok) return new NextResponse(await res.text(), { status: res.status });
    logFile(user!, server!.id, "file.download", `Téléchargement : ${path}`);
    const name = path.split("/").pop() || "fichier";
    return new NextResponse(res.body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  }

  const res = await agentFetch("/files/list", vol!, path);
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}

// POST : opérations (?op=write|upload|mkdir|delete|rename).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const op = url.searchParams.get("op") ?? "";
  const path = url.searchParams.get("path") ?? "";

  // delete → files.delete ; téléchargement groupé → files.read ; sinon écriture.
  const permission =
    op === "delete" ? "files.delete" : op === "archive" ? "files.read" : "files.write";
  const { vol, user, server, error } = await resolve(id, permission);
  if (error) return error;
  const log = (action: string, detail: string) =>
    logFile(user!, server!.id, action, detail);

  switch (op) {
    // Compression d'une sélection en une archive (tar.gz ou zip).
    case "compress": {
      const b = await request.json().catch(() => ({}));
      const res = await agentFetch("/archive/compress", vol!, "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: b.paths ?? [], dest: b.dest ?? "", format: b.format ?? "targz" }),
      });
      if (res.ok) log("file.compress", `Compression : ${b.dest ?? ""}`);
      return new NextResponse(await res.text(), { status: res.status });
    }
    // Extraction d'une archive (path) dans un dossier.
    case "extract": {
      const b = await request.json().catch(() => ({}));
      const res = await agentFetch("/archive/extract", vol!, path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dest: b.dest ?? "" }),
      });
      if (res.ok) log("file.extract", `Extraction : ${path}`);
      return new NextResponse(await res.text(), { status: res.status });
    }
    // Téléchargement groupé : archive à la volée de la sélection.
    case "archive": {
      const b = await request.json().catch(() => ({}));
      const res = await agentFetch("/archive/stream", vol!, "", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: b.paths ?? [] }),
      });
      if (!res.ok) return new NextResponse(await res.text(), { status: res.status });
      return new NextResponse(res.body, {
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="selection.tar.gz"`,
        },
      });
    }
    case "write":
    case "upload": {
      const body = await request.arrayBuffer();
      const res = await agentFetch(`/files/${op}`, vol!, path, {
        method: "POST",
        body: Buffer.from(body),
      });
      if (res.ok) {
        log(
          op === "upload" ? "file.upload" : "file.write",
          `${op === "upload" ? "Envoi" : "Modification"} : ${path}`,
        );
      }
      return new NextResponse(await res.text(), { status: res.status });
    }
    case "mkdir":
    case "delete": {
      const res = await agentFetch(`/files/${op}`, vol!, path, { method: "POST" });
      if (res.ok) {
        log(
          op === "delete" ? "file.delete" : "file.mkdir",
          `${op === "delete" ? "Suppression" : "Dossier créé"} : ${path}`,
        );
      }
      return new NextResponse(await res.text(), { status: res.status });
    }
    case "rename": {
      const json = await request.json().catch(() => ({}));
      const res = await agentFetch("/files/rename", vol!, path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: json.to ?? "" }),
      });
      if (res.ok) log("file.rename", `Renommage : ${path} → ${json.to ?? ""}`);
      return new NextResponse(await res.text(), { status: res.status });
    }
    default:
      return NextResponse.json({ error: "opération inconnue" }, { status: 400 });
  }
}
