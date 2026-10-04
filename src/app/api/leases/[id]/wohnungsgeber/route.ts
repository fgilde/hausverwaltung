import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { roleAllows } from "@/lib/rbac";
import { wohnungsgeberPdf, type WgOptions } from "@/server/wohnungsgeber";

// Wohnungsgeberbestätigung (§ 19 BMG) als PDF zu einem Mietvertrag.
// Wohnungsgeber, Ort/Datum und Unterschrift kommen aus dem Dialog (#41/#55);
// GET mit Query (ohne Unterschrift), POST als Formular (mit Unterschrift).
async function handle(req: Request, id: string, opt: WgOptions) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!roleAllows(session.user.role, ["VERWALTER", "BUCHHALTUNG"])) return new Response("Forbidden", { status: 403 });
  const res = await wohnungsgeberPdf(await actingTenantId(session.user), id, opt);
  if (!res) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(res.pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Wohnungsgeberbestaetigung.pdf"` },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const q = new URL(req.url).searchParams;
  return handle(req, (await params).id, Object.fromEntries(q) as WgOptions);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const fd = await req.formData();
  const opt = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])) as WgOptions;
  return handle(req, (await params).id, opt);
}
