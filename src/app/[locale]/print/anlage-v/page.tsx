import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { computeAnlageV } from "@/server/tax";
import { PrintButton } from "@/components/print-button";
import { AnlageVTable, AnlageVNotes } from "@/components/anlage-v-table";

// Druckansicht der Anlage-V-Übersicht (#103).
export default async function PrintAnlageVPage({ searchParams }: { searchParams: Promise<{ propertyId?: string; year?: string }> }) {
  const sp = await searchParams;
  const user = await requireRole(["VERWALTER", "BUCHHALTUNG"]);
  const t = await getTranslations();
  const year = Number(sp.year) || new Date().getFullYear() - 1;
  const property = sp.propertyId
    ? await prisma.property.findFirst({ where: { id: sp.propertyId, tenantId: user.tenantId }, include: { tenant: { select: { name: true } } } })
    : null;
  if (!property) notFound();
  const data = await computeAnlageV(user.tenantId, property.id, year);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-3xl p-8 text-sm text-black">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="text-xs text-neutral-500">{property.tenant.name}</div>
          <h1 className="text-xl font-bold">{t("tax.anlageV", { year: String(year) })}</h1>
          <div className="text-neutral-600">{property.name} · {property.street}, {property.zip} {property.city}</div>
        </div>
        <PrintButton />
      </div>
      <AnlageVTable data={data} print />
      <AnlageVNotes data={data} className="mt-6 text-xs text-neutral-600" />
    </div>
  );
}
