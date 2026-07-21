import { NextResponse } from "next/server";
import { sessionUser } from "@/lib/auth/user";
import { agentFetch, serverVolumeFor } from "@/lib/servers/files";

async function resolve(id: string) {
  const user = await sessionUser();
  if (!user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  try {
    const { vol } = await serverVolumeFor(user, id);
    return { vol };
  } catch (e) {
    return {
      error: NextResponse.json(
        { error: e instanceof Error ? e.message : "Erreur" },
        { status: 404 },
      ),
    };
  }
}

// GET : liste d'un dossier (défaut), contenu brut (?raw=1) ou téléchargement (?download=1).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { vol, error } = await resolve(id);
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
  const { vol, error } = await resolve(id);
  if (error) return error;

  const url = new URL(request.url);
  const op = url.searchParams.get("op") ?? "";
  const path = url.searchParams.get("path") ?? "";

  switch (op) {
    case "write":
    case "upload": {
      const body = await request.arrayBuffer();
      const res = await agentFetch(`/files/${op}`, vol!, path, {
        method: "POST",
        body: Buffer.from(body),
      });
      return new NextResponse(await res.text(), { status: res.status });
    }
    case "mkdir":
    case "delete": {
      const res = await agentFetch(`/files/${op}`, vol!, path, { method: "POST" });
      return new NextResponse(await res.text(), { status: res.status });
    }
    case "rename": {
      const json = await request.json().catch(() => ({}));
      const res = await agentFetch("/files/rename", vol!, path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: json.to ?? "" }),
      });
      return new NextResponse(await res.text(), { status: res.status });
    }
    default:
      return NextResponse.json({ error: "opération inconnue" }, { status: 400 });
  }
}
