import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BOT_DOMAIN = "dashboard.lossnear.com";

/**
 * Domaine public du bot : `dashboard.lossnear.com` sert le dashboard bot à sa
 * racine. On réécrit uniquement la racine vers `/bot` (la navigation et les
 * routes partagées — /api, /callback — passent inchangées). Sur les autres
 * hôtes (k8s.lossnear.com), aucun effet.
 *
 * (Convention Next « proxy », ex-« middleware ».)
 */
export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  if (host === BOT_DOMAIN && req.nextUrl.pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/bot";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

// N'intercepte que la racine : coût nul sur le reste du trafic.
export const config = { matcher: ["/"] };
