import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { listEconomicPlans } from "@/lib/api-data";

export async function GET(req: Request) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  return Response.json(await listEconomicPlans(p.tenantId));
}
