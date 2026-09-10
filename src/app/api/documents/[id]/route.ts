import path from "node:path";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const tenantId = (await actingTenantId(session.user));
  const role = session.user.role;

  // Portal-Rollen dürfen nur Dokumente laden, die ausdrücklich ihrer Person
  // zugeordnet sind. Objekt-/Wohnungs-Dokumente ohne Personenbezug (Steuer,
  // Versicherung, Kauf …) bleiben intern (Datenschutz, siehe Portal-Liste).
  let where: import("@prisma/client").Prisma.DocumentWhereInput = { id, tenantId };
  if (role === "MIETER" || role === "EIGENTUEMER" || role === "HANDWERKER") {
    const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { personId: true } });
    where = { id, tenantId, personId: u?.personId ?? "__none__" };
  }

  const doc = await prisma.document.findFirst({ where });
  if (!doc) return new Response("Not found", { status: 404 });

  const buf = await readFile(doc.storageKey);
  // Dateiendung bewahren: fehlt sie im Anzeigenamen, aus dem Storage-Key ergänzen.
  const ext = path.extname(doc.storageKey);
  const filename = ext && !path.extname(doc.name) ? doc.name + ext : doc.name;
  const asciiName = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  // ?inline=1 → im Browser anzeigen statt herunterladen (Vorschau)
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
