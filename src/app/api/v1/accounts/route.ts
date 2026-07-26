import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { listAccounts } from "@/lib/api-data";

export async function GET(req: Request) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  return Response.json(await listAccounts(p.tenantId));
}
