import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { roleAllows } from "@/lib/rbac";
import { toDatevCsv, type DatevRow } from "@/lib/adapters/datev";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!roleAllows(session.user.role, ["VERWALTER", "BUCHHALTUNG"]))
    return new Response("Forbidden", { status: 403 });

  const payments = await prisma.payment.findMany({
    where: { tenantId: session.user.tenantId },
    include: { charge: true },
    orderBy: { date: "asc" },
  });

  const rows: DatevRow[] = payments.map((p) => ({
    amount: Number(p.amount),
    debitCredit: p.direction === "EINGANG" ? "S" : "H",
    account: "1200", // Bank
    contraAccount: "8000", // Erlöse (Platzhalter-Kontenrahmen)
    date: p.date.toISOString().slice(0, 10),
    text: p.reference ?? (p.charge ? p.charge.type : "Zahlung"),
  }));

  const csv = "﻿" + toDatevCsv(rows); // BOM für Excel/DATEV
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="datev-export.csv"`,
    },
  });
}
