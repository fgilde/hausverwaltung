import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { listTasks, createTask } from "@/lib/api-data";

export async function GET(req: Request) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  return Response.json(await listTasks(p.tenantId));
}

export async function POST(req: Request) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  const body = await req.json().catch(() => null);
  if (!body?.title) return Response.json({ error: "title erforderlich" }, { status: 400 });
  const created = await createTask(p.tenantId, { title: String(body.title), dueDate: body.dueDate });
  return Response.json(created, { status: 201 });
}
