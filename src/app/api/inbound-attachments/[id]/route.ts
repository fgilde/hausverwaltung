import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";

// Noch nicht übernommener Anhang einer eingehenden Mail (#52). Nur für die
// Verwaltung, nicht für Portal-Rollen (die Mail selbst ist intern).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (["MIETER", "EIGENTUEMER", "HANDWERKER"].includes(session.user.role)) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const tenantId = await actingTenantId(session.user);
  const att = await prisma.inboundEmailAttachment.findFirst({ where: { id, inboundEmail: { tenantId } } });
  if (!att) return new Response("Not found", { status: 404 });

  const buf = await readFile(att.storageKey);
  const asciiName = att.name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": att.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(att.name)}`,
      "X-Content-Type-Options": "nosniff",
      // Fremde Dateien (z. B. HTML/SVG) dürfen unter unserer Origin keine Skripte ausführen.
      "Content-Security-Policy": "sandbox",
    },
  });
}
