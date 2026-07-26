import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { runOperation } from "@/lib/api-ops";
import { ApiWriteError } from "@/lib/api-write";

export async function POST(req: Request, { params }: { params: Promise<{ op: string }> }) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  const { op } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    return Response.json(await runOperation(p, op, body ?? {}));
  } catch (e) {
    if (e instanceof ApiWriteError) return Response.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
