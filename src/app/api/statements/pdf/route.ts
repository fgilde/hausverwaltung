import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { roleAllows } from "@/lib/rbac";
import { statementPdfFor } from "@/server/statement-pdf";

// Betriebskostenabrechnung als PDF (#94, #102): ohne `key` Übersicht + alle Einzelabrechnungen,
// mit `key` (Mietverhältnis) nur dessen Einzelabrechnung. Ersetzt die HTML-Druckansicht.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!roleAllows(session.user.role, ["VERWALTER", "BUCHHALTUNG"])) return new Response("Forbidden", { status: 403 });

  const q = new URL(req.url).searchParams;
  const propertyId = q.get("propertyId") ?? "";
  const year = Number(q.get("year")) || new Date().getFullYear();
  const tenantId = await actingTenantId(session.user);
  const res = await statementPdfFor(tenantId, propertyId, year, q.get("key") ?? undefined);
  if (!res) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(res.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${res.name.replace(/[^\x20-\x7e]/g, "_")}.pdf"`,
    },
  });
}
