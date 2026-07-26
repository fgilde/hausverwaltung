import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { listEntities } from "@/lib/api-write";

// Schema-Discovery: welche Entitäten schreibbar sind + ihre Felder.
export async function GET(req: Request) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  return Response.json(listEntities());
}
