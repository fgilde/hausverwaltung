import { getTranslations, getLocale } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { money } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const DAY = 86_400_000;

export default async function DunningPage({
  searchParams,
}: {
  searchParams: Promise<{ minDays?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getTranslations();
  const locale = await getLocale();
  const minDays = Math.max(0, Number(sp.minDays) || 0);
  const now = new Date();

  const charges = await prisma.charge.findMany({
    where: { tenantId: user.tenantId },
    include: {
      payments: { select: { amount: true } },
      dunnings: { select: { level: true } },
      lease: { include: { unit: { include: { building: { include: { property: true } } } } } },
    },
  });

  type Row = {
    propertyId: string;
    name: string;
    debitoren: Set<string>;
    opOpen: number;
    opGemahnt: number;
    opNichtGemahnt: number;
    maxVerzug: number;
    schuld: number;
  };
  const map = new Map<string, Row>();

  for (const c of charges) {
    const paid = c.payments.reduce((a, p) => a + Number(p.amount), 0);
    const open = Number(c.amount) - paid;
    if (open <= 0.001) continue;
    const verzug = c.dueDate < now ? Math.floor((now.getTime() - c.dueDate.getTime()) / DAY) : 0;
    if (verzug < minDays) continue;

    const prop = c.lease?.unit.building.property;
    const key = prop?.id ?? "__none__";
    const name = prop?.name ?? t("common.none");
    let row = map.get(key);
    if (!row) {
      row = { propertyId: key, name, debitoren: new Set(), opOpen: 0, opGemahnt: 0, opNichtGemahnt: 0, maxVerzug: 0, schuld: 0 };
      map.set(key, row);
    }
    if (c.leaseId) row.debitoren.add(c.leaseId);
    row.opOpen += 1;
    if (c.dunnings.length > 0) row.opGemahnt += 1;
    else row.opNichtGemahnt += 1;
    row.maxVerzug = Math.max(row.maxVerzug, verzug);
    row.schuld += open;
  }

  const rows = [...map.values()].sort((a, b) => b.schuld - a.schuld);
  const totalSchuld = rows.reduce((a, r) => a + r.schuld, 0);
  const totalOp = rows.reduce((a, r) => a + r.opOpen, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("dunning.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("dunning.subtitle")}</p>
      </div>

      <form className="flex items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">{t("dunning.minDays")}</label>
          <input
            name="minDays"
            type="number"
            defaultValue={minDays}
            className="flex h-9 w-32 rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
          />
        </div>
        <Button type="submit" size="sm" variant="outline">{t("common.search")}</Button>
      </form>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{t("dunning.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dunning.property")}</TableHead>
                  <TableHead className="text-right">{t("dunning.debtors")}</TableHead>
                  <TableHead className="text-right">{t("dunning.openItems")}</TableHead>
                  <TableHead className="text-right">{t("dunning.dunned")}</TableHead>
                  <TableHead className="text-right">{t("dunning.notDunned")}</TableHead>
                  <TableHead className="text-right">{t("dunning.maxDelay")}</TableHead>
                  <TableHead className="text-right">{t("dunning.debt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.propertyId}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.debitoren.size}</TableCell>
                    <TableCell className="text-right">{r.opOpen}</TableCell>
                    <TableCell className="text-right">{r.opGemahnt}</TableCell>
                    <TableCell className="text-right text-destructive">{r.opNichtGemahnt}</TableCell>
                    <TableCell className="text-right">{r.maxVerzug}</TableCell>
                    <TableCell className="text-right font-medium">{money(r.schuld, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">{t("dunning.total")}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-semibold">{totalOp}</TableCell>
                  <TableCell colSpan={3} />
                  <TableCell className="text-right font-semibold">{money(totalSchuld, locale)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
