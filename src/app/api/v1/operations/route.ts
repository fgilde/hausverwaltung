import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { listOperations } from "@/lib/api-ops";

// Discovery: verfügbare Operationen (kein reines CRUD) mit Parametern.
export async function GET(req: Request) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  return Response.json(listOperations());
}
