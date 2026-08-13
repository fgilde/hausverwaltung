import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const tickets = await prisma.ticket.findMany({
    where: { tenantId: session.user.tenantId },
    include: { property: { select: { name: true } }, assignee: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const rows = tickets.map((t) => [
    t.title,
    t.category,
    t.status,
    t.priority,
    t.property?.name ?? "",
    t.assignee?.name ?? "",
    t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "",
    t.timeSpentMin,
  ]);
  return csvResponse(
    "tickets.csv",
    toCsv(["Titel", "Kategorie", "Status", "Prioritaet", "Objekt", "Zustaendig", "Faellig", "ZeitMin"], rows),
  );
}
