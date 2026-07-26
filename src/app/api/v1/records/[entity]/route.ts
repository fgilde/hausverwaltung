import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { apiCreate, ApiWriteError } from "@/lib/api-write";

export async function POST(req: Request, { params }: { params: Promise<{ entity: string }> }) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  const { entity } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const result = await apiCreate(p, entity, body);
    return Response.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof ApiWriteError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
