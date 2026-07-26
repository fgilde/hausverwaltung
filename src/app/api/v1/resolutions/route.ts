import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { listResolutions } from "@/lib/api-data";

export async function GET(req: Request) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  return Response.json(await listResolutions(p.tenantId));
}
