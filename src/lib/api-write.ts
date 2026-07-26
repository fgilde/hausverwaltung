import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { roleAllows, WRITE_ROLES, assignableRoles, canDeleteUser, type SessionUser } from "@/lib/rbac";
import type { ApiPrincipal } from "@/lib/api-auth";
import * as S from "@/lib/schemas";

// Generische, mandanten-gescopte Schreibschicht für REST-API + MCP.
// Nutzt dieselben zod-Schemas wie die Server Actions (Feld-Whitelist, Enums,
// Coercion) — JSON-Eingaben werden vorher zu Strings normalisiert, damit die
// FormData-orientierten Schemas greifen. Jede Relation-ID wird gegen den
// Mandanten geprüft (kein Fremdzugriff, keine Mass-Assignment).

export class ApiWriteError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type Def = {
  model: string; // Prisma-Delegate (camelCase)
  create: z.ZodTypeAny;
  update?: z.ZodTypeAny; // fehlt → nicht aktualisierbar
  relations?: Record<string, string>; // Feld → Delegate für Tenant-Prüfung
  custom?: boolean; // Json-Feld `custom` erlaubt
  special?: "lease" | "resolution" | "agenda" | "user";
  upsertBy?: string[]; // Felder für Upsert-Where (statt create)
};

// prisma[model] dynamisch. Prisma-Delegates sind camelCase des Modellnamens.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const REGISTRY: Record<string, Def> = {
  property: { model: "property", create: S.propertySchema, update: S.propertySchema, custom: true },
  building: { model: "building", create: S.buildingSchema, update: S.buildingSchema, relations: { propertyId: "property" } },
  unit: { model: "unit", create: S.unitSchema, update: S.unitSchema, relations: { buildingId: "building" }, custom: true },
  meter: { model: "meter", create: S.meterSchema, relations: { unitId: "unit" } },
  reading: { model: "meterReading", create: S.readingSchema, relations: { meterId: "meter" } },
  person: { model: "person", create: S.personSchema, update: S.personSchema, custom: true },
  owner: { model: "owner", create: S.ownerSchema, relations: { personId: "person", unitId: "unit" } },
  lease: {
    model: "lease",
    create: S.leaseCreateSchema,
    update: S.leaseUpdateSchema,
    relations: { unitId: "unit", personId: "person" },
    custom: true,
    special: "lease",
  },
  component: { model: "rentComponent", create: S.rentComponentSchema, relations: { leaseId: "lease" } },
  adjustment: { model: "rentAdjustment", create: S.rentAdjustmentSchema, relations: { leaseId: "lease" } },
  deposit: { model: "deposit", create: S.depositSchema, relations: { leaseId: "lease", accountId: "account" }, upsertBy: ["leaseId"] },
  account: { model: "account", create: S.accountSchema, update: S.accountSchema },
  charge: { model: "charge", create: S.chargeSchema, relations: { leaseId: "lease" } },
  payment: { model: "payment", create: S.paymentSchema, relations: { chargeId: "charge", accountId: "account" } },
  mandate: { model: "sepaMandate", create: S.mandateSchema, relations: { personId: "person" } },
  cost: { model: "costEntry", create: S.costEntrySchema, relations: { propertyId: "property" } },
  "economic-plan": { model: "economicPlan", create: S.economicPlanSchema, relations: { propertyId: "property" }, upsertBy: ["propertyId", "year"] },
  reserve: { model: "reserve", create: S.reserveSchema, relations: { propertyId: "property" } },
  "reserve-transaction": { model: "reserveTransaction", create: S.reserveTxSchema, relations: { reserveId: "reserve" } },
  meeting: { model: "meeting", create: S.meetingCreateSchema, update: S.meetingUpdateSchema, relations: { propertyId: "property" } },
  agenda: { model: "agendaItem", create: S.agendaSchema, relations: { meetingId: "meeting" }, special: "agenda" },
  resolution: { model: "resolution", create: S.resolutionSchema, relations: { propertyId: "property", meetingId: "meeting" }, special: "resolution" },
  appointment: { model: "appointment", create: S.appointmentSchema, update: S.appointmentSchema, relations: { propertyId: "property" } },
  task: { model: "task", create: S.taskSchema, update: S.taskSchema },
  contractor: { model: "contractor", create: S.contractorSchema, update: S.contractorSchema },
  ticket: { model: "ticket", create: S.ticketCreateSchema, update: S.ticketUpdateSchema, relations: { propertyId: "property", unitId: "unit", contractorId: "contractor" } },
  maintenance: { model: "maintenanceContract", create: S.maintenanceSchema, relations: { propertyId: "property", contractorId: "contractor" } },
  insurance: { model: "insurance", create: S.insuranceSchema, update: S.insuranceSchema, relations: { propertyId: "property" } },
  "property-tax": { model: "propertyTax", create: S.propertyTaxSchema, relations: { propertyId: "property" }, upsertBy: ["propertyId"] },
  template: { model: "template", create: S.templateSchema, update: S.templateSchema },
  "custom-field": { model: "customFieldDef", create: S.customFieldDefSchema },
  user: { model: "user", create: S.userCreateSchema, special: "user" },
};

export const ENTITIES = Object.keys(REGISTRY);

function requireWrite(p: ApiPrincipal) {
  if (!roleAllows(p.role, WRITE_ROLES)) throw new ApiWriteError("Keine Schreibberechtigung", 403);
}

// JSON-Werte zu Strings, damit die FormData-orientierten Schemas greifen.
function normalize(body: Record<string, unknown>, custom: boolean) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (v === null || v === undefined || k === "custom") continue;
    out[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  const customData = custom && body?.custom && typeof body.custom === "object" ? (body.custom as Record<string, unknown>) : undefined;
  return { out, customData };
}

async function checkRelations(tenantId: string, relations: Record<string, string> | undefined, data: Record<string, unknown>) {
  if (!relations) return;
  for (const [field, model] of Object.entries(relations)) {
    const id = data[field];
    if (!id) continue;
    const row = await db[model].findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!row) throw new ApiWriteError(`${field}: nicht gefunden`, 400);
  }
}

function parse(schema: z.ZodTypeAny, input: Record<string, unknown>) {
  const r = schema.safeParse(input);
  if (!r.success) throw new ApiWriteError(r.error.issues[0]?.message ?? "Ungültige Eingabe", 400);
  return r.data as Record<string, unknown>;
}

export function listEntities() {
  return ENTITIES.map((entity) => {
    const def = REGISTRY[entity];
    // zod v4: öffentliches `.shape` ist ein Objekt der Feldnamen.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shape = (def.create as any).shape ?? {};
    return {
      entity,
      writable: !!def.update || !!def.upsertBy,
      fields: Object.keys(shape),
      relations: def.relations ? Object.keys(def.relations) : [],
    };
  });
}

export async function apiCreate(p: ApiPrincipal, entity: string, body: Record<string, unknown>) {
  const def = REGISTRY[entity];
  if (!def) throw new ApiWriteError(`Unbekannte Entität: ${entity}`, 404);
  requireWrite(p);
  const { out, customData } = normalize(body, !!def.custom);
  const data = parse(def.create, out);
  await checkRelations(p.tenantId, def.relations, data);
  const tenantId = p.tenantId;

  if (def.special === "user") {
    const bcrypt = (await import("bcryptjs")).default;
    const actor: SessionUser = { id: p.userId, tenantId, role: p.role, name: p.name };
    const { name, email, password, role, personId } = data as {
      name: string; email: string; password: string; role: SessionUser["role"]; personId?: string;
    };
    if (!assignableRoles(actor.role).includes(role)) throw new ApiWriteError("Für diese Rolle fehlt die Berechtigung", 403);
    if (await db.user.findUnique({ where: { email }, select: { id: true } })) throw new ApiWriteError("E-Mail bereits vergeben", 409);
    const created = await db.user.create({
      data: { tenantId, name, email, role, personId: personId ?? null, passwordHash: await bcrypt.hash(password, 10) },
    });
    return { id: created.id };
  }

  if (def.upsertBy) {
    const where = Object.fromEntries(def.upsertBy.map((k) => [k, data[k]]));
    const whereKey = def.upsertBy.length > 1 ? { [def.upsertBy.join("_")]: where } : where;
    const { ...updateData } = data;
    for (const k of def.upsertBy) delete updateData[k];
    const row = await db[def.model].upsert({
      where: whereKey,
      create: { ...data, tenantId, ...(customData ? { custom: customData } : {}) },
      update: updateData,
    });
    return { id: row.id };
  }

  if (def.special === "lease") {
    const { unitId, personId, ...rest } = data as { unitId: string; personId: string };
    const row = await db.lease.create({
      data: { ...rest, tenantId, unitId, ...(customData ? { custom: customData } : {}), renters: { create: { tenantId, personId } } },
    });
    return { id: row.id };
  }

  if (def.special === "resolution") {
    const last = await db.resolution.findFirst({ where: { propertyId: data.propertyId, tenantId }, orderBy: { number: "desc" }, select: { number: true } });
    const row = await db.resolution.create({ data: { ...data, tenantId, number: (last?.number ?? 0) + 1 } });
    return { id: row.id };
  }

  if (def.special === "agenda") {
    const count = await db.agendaItem.count({ where: { meetingId: data.meetingId } });
    const row = await db.agendaItem.create({ data: { ...data, tenantId, position: count + 1 } });
    return { id: row.id };
  }

  const row = await db[def.model].create({ data: { ...data, tenantId, ...(customData ? { custom: customData } : {}) } });
  return { id: row.id };
}

export async function apiUpdate(p: ApiPrincipal, entity: string, id: string, body: Record<string, unknown>) {
  const def = REGISTRY[entity];
  if (!def) throw new ApiWriteError(`Unbekannte Entität: ${entity}`, 404);
  if (!def.update) throw new ApiWriteError(`${entity} ist nicht aktualisierbar`, 405);
  requireWrite(p);
  const { out, customData } = normalize(body, !!def.custom);
  const data = parse(def.update, out);
  await checkRelations(p.tenantId, def.relations, data);
  const res = await db[def.model].updateMany({
    where: { id, tenantId: p.tenantId },
    data: { ...data, ...(customData ? { custom: customData } : {}) },
  });
  if (res.count === 0) throw new ApiWriteError("Nicht gefunden", 404);
  return { id, updated: res.count };
}

export async function apiDelete(p: ApiPrincipal, entity: string, id: string) {
  const def = REGISTRY[entity];
  if (!def) throw new ApiWriteError(`Unbekannte Entität: ${entity}`, 404);
  requireWrite(p);

  if (def.special === "user") {
    const target = await db.user.findFirst({ where: { id, tenantId: p.tenantId }, select: { id: true, role: true } });
    if (!target) throw new ApiWriteError("Nicht gefunden", 404);
    const actor: SessionUser = { id: p.userId, tenantId: p.tenantId, role: p.role };
    if (!canDeleteUser(actor, target.role, target.id)) throw new ApiWriteError("Löschen nicht erlaubt", 403);
    await db.user.delete({ where: { id: target.id } });
    return { id, deleted: 1 };
  }

  const res = await db[def.model].deleteMany({ where: { id, tenantId: p.tenantId } });
  if (res.count === 0) throw new ApiWriteError("Nicht gefunden", 404);
  return { id, deleted: res.count };
}
