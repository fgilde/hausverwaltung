import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { roleAllows, WRITE_ROLES } from "@/lib/rbac";
import { buildLetterPdf } from "@/server/letters";

// Vorschau eines Briefs (#58) aus dem Dialog: PDF erzeugen, nichts speichern.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!roleAllows(session.user.role, WRITE_ROLES)) return new Response("Forbidden", { status: 403 });
  const fd = await req.formData();
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  const pdf = await buildLetterPdf(await actingTenantId(session.user), {
    recipient: s("recipient").split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
    subject: s("subject"),
    body: s("body"),
    place: s("place"),
    date: s("date"),
  });
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Brief-Vorschau.pdf"` },
  });
}
