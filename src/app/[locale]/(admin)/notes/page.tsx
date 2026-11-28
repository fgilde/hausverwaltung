import { getTranslations } from "next-intl/server";
import { requireUser, roleAllows, WRITE_ROLES } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { NoteCards, NoteDialog } from "@/components/notes";

// Zentrale Notizen (#89): alle Notizen, filterbar nach Objekt, Einheit, Person und Text.
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; prop?: string; unit?: string; person?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const canWrite = roleAllows(user.role, WRITE_ROLES);
  const t = await getTranslations();
  const tenantId = user.tenantId;
  const q = (sp.q ?? "").trim();

  const [notes, properties, units, persons] = await Promise.all([
    prisma.note.findMany({
      where: {
        tenantId,
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }] } : {}),
        ...(sp.prop ? { propertyId: sp.prop } : {}),
        ...(sp.unit ? { unitId: sp.unit } : {}),
        ...(sp.person ? { personId: sp.person } : {}),
      },
      include: {
        property: { select: { name: true } },
        unit: { select: { label: true } },
        person: { select: { firstName: true, lastName: true } },
        _count: { select: { documents: true } },
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.property.findMany({ where: { tenantId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.unit.findMany({
      where: { tenantId },
      include: { building: { include: { property: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.person.findMany({ where: { tenantId }, orderBy: { lastName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
  ]);
  const options = {
    properties: properties.map((p) => ({ value: p.id, label: p.name })),
    units: units.map((u) => ({ value: u.id, label: `${u.building.property.name} · ${u.label}` })),
    persons: persons.map((p) => ({ value: p.id, label: `${p.lastName}, ${p.firstName}` })),
  };
  const filterCls = "flex h-9 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("notes.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("notes.subtitle")}</p>
        </div>
        {canWrite && <NoteDialog {...options} />}
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <input name="q" defaultValue={q} placeholder={t("notes.search")} className={`${filterCls} w-56 px-3`} />
        <select name="prop" defaultValue={sp.prop ?? ""} className={filterCls}>
          <option value="">{t("documents.allProperties")}</option>
          {options.properties.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select name="unit" defaultValue={sp.unit ?? ""} className={filterCls}>
          <option value="">{t("notes.allUnits")}</option>
          {options.units.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select name="person" defaultValue={sp.person ?? ""} className={filterCls}>
          <option value="">{t("notes.allPersons")}</option>
          {options.persons.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="submit" className="h-9 rounded-lg border px-3 text-sm hover:bg-muted">{t("common.search")}</button>
      </form>

      <Card>
        <CardContent className="pt-4">
          <NoteCards
            canWrite={canWrite}
            options={options}
            notes={notes.map((n) => ({
              ...n,
              documentCount: n._count.documents,
              linked: [n.property?.name, n.unit?.label, n.person ? `${n.person.firstName} ${n.person.lastName}` : null]
                .filter(Boolean)
                .join(" · "),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
