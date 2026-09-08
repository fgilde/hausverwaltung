import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const persons = await prisma.person.findMany({
    where: { tenantId: (await actingTenantId(session.user)) },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const rows = persons.map((p) => [p.firstName, p.lastName, p.email ?? "", p.phone ?? "", p.type, p.note ?? ""]);
  return csvResponse("personen.csv", toCsv(["firstName", "lastName", "email", "phone", "type", "note"], rows));
}
