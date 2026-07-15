import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { roleAllows } from "@/lib/rbac";
import { toPain008, type SepaEntry } from "@/lib/adapters/sepa";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (!roleAllows(session.user.role, ["VERWALTER", "BUCHHALTUNG"]))
    return new Response("Forbidden", { status: 403 });

  const tenantId = session.user.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  const mandates = await prisma.sepaMandate.findMany({
    where: { tenantId, active: true },
    include: {
      person: {
        include: {
          renters: {
            include: { lease: { include: { charges: { include: { payments: { select: { amount: true } } } } } } },
          },
        },
      },
    },
  });

  const entries: SepaEntry[] = [];
  for (const m of mandates) {
    let open = 0;
    for (const r of m.person.renters) {
      for (const c of r.lease.charges) {
        open += Number(c.amount) - c.payments.reduce((a, p) => a + Number(p.amount), 0);
      }
    }
    open = Math.round(open * 100) / 100;
    if (open > 0) {
      entries.push({
        mandateRef: m.mandateRef,
        iban: m.iban,
        debtorName: `${m.person.firstName} ${m.person.lastName}`,
        amount: open,
        reference: `Einzug ${tenant?.name ?? "HaVeWa"}`,
      });
    }
  }

  const xml = toPain008(entries, {
    creditorName: tenant?.name ?? "HaVeWa",
    creditorIban: "DE00000000000000000000",
    creditorId: "DE00ZZZ00000000000",
    msgId: `HAVEWA-${Date.now()}`,
    createdAt: new Date().toISOString(),
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="sepa-lastschrift.xml"`,
    },
  });
}
