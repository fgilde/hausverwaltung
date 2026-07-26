import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { listMaintenanceContracts } from "@/lib/api-data";

export async function GET(req: Request) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  return Response.json(await listMaintenanceContracts(p.tenantId));
}
