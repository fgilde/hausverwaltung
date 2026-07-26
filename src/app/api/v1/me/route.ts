import { authenticateBearer, unauthorized } from "@/lib/api-auth";
import { portfolioSummary } from "@/lib/api-data";

export async function GET(req: Request) {
  const p = await authenticateBearer(req);
  if (!p) return unauthorized();
  return Response.json({
    user: { id: p.userId, name: p.name, role: p.role },
    summary: await portfolioSummary(p.tenantId),
  });
}
