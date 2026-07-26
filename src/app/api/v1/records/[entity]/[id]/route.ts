import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { apiUpdate, apiDelete, ApiWriteError } from "@/lib/api-write";

type Ctx = { params: Promise<{ entity: string; id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  const { entity, id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    return Response.json(await apiUpdate(p, entity, id, body));
  } catch (e) {
    if (e instanceof ApiWriteError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  const { entity, id } = await params;
  try {
    return Response.json(await apiDelete(p, entity, id));
  } catch (e) {
    if (e instanceof ApiWriteError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
