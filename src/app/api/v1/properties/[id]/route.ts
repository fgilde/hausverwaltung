import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { getProperty } from "@/lib/api-data";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  const { id } = await params;
  const r = await getProperty(p.tenantId, id);
  if (!r) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(r);
}
