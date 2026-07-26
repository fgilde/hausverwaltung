import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { listPersons, createPerson } from "@/lib/api-data";

export async function GET(req: Request) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  return Response.json(await listPersons(p.tenantId));
}

export async function POST(req: Request) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body?.firstName || !body?.lastName) {
    return Response.json({ error: "firstName und lastName erforderlich" }, { status: 400 });
  }
  return Response.json(await createPerson(p.tenantId, body), { status: 201 });
}
