import { z } from "zod";

export type ActionState = { ok?: boolean; error?: string };

const optionalStr = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const propertySchema = z.object({
  name: z.string().trim().min(1),
  street: z.string().trim().min(1),
  zip: z.string().trim().min(1),
  city: z.string().trim().min(1),
  type: z.enum(["WOHNEN", "GEWERBE", "GEMISCHT"]),
  management: z.enum(["MIET", "WEG"]),
});

export const buildingSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().trim().min(1),
});

export const unitSchema = z.object({
  buildingId: z.string().min(1),
  label: z.string().trim().min(1),
  type: z.enum(["WOHNUNG", "GEWERBE", "STELLPLATZ", "KELLER", "SONSTIGES"]),
  area: z.coerce.number().nonnegative(),
  rooms: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  mea: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined)),
});

export const personSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: optionalStr,
  phone: optionalStr,
});

export const meterSchema = z.object({
  unitId: z.string().min(1),
  type: z.enum(["STROM", "GAS", "WASSER_KALT", "WASSER_WARM", "WAERME"]),
  serialNo: z.string().trim().min(1),
});

export const readingSchema = z.object({
  meterId: z.string().min(1),
  date: z.coerce.date(),
  value: z.coerce.number().nonnegative(),
});

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined));

const optionalNum = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? Number(v) : undefined));

export const leaseCreateSchema = z.object({
  unitId: z.string().min(1),
  personId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: optionalDate,
  rentCold: z.coerce.number().nonnegative(),
  personCount: z.coerce.number().int().positive(),
  noticePeriodM: optionalNum,
});

export const leaseUpdateSchema = z.object({
  startDate: z.coerce.date(),
  endDate: optionalDate,
  rentCold: z.coerce.number().nonnegative(),
  personCount: z.coerce.number().int().positive(),
  noticePeriodM: optionalNum,
});

export const rentComponentSchema = z.object({
  leaseId: z.string().min(1),
  type: z.enum(["NEBENKOSTEN", "HEIZKOSTEN", "STELLPLATZ", "MODERNISIERUNG", "SONSTIGES"]),
  amount: z.coerce.number().nonnegative(),
  note: optionalStr,
});

export const rentAdjustmentSchema = z.object({
  leaseId: z.string().min(1),
  type: z.enum(["STAFFEL", "INDEX"]),
  effectiveDate: z.coerce.date(),
  newRentCold: z.coerce.number().nonnegative(),
  indexBase: optionalNum,
  indexNew: optionalNum,
  note: optionalStr,
});

export const depositSchema = z.object({
  leaseId: z.string().min(1),
  type: z.enum(["BAR", "BUERGSCHAFT", "VERPFAENDET", "KAUTIONSKONTO"]),
  amount: z.coerce.number().nonnegative(),
  receivedDate: optionalDate,
  note: optionalStr,
});

export const renterSchema = z.object({
  leaseId: z.string().min(1),
  personId: z.string().min(1),
});

export const accountSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["BANK", "KAUTION", "RUECKLAGE", "SACHKONTO"]),
  iban: optionalStr,
});

export const chargeSchema = z.object({
  leaseId: optionalStr,
  type: z.enum(["MIETE", "NEBENKOSTEN", "HAUSGELD", "SONSTIGES"]),
  period: z.coerce.date(),
  dueDate: z.coerce.date(),
  amount: z.coerce.number(),
  description: optionalStr,
});

export const paymentSchema = z.object({
  chargeId: optionalStr,
  accountId: optionalStr,
  date: z.coerce.date(),
  amount: z.coerce.number(),
  direction: z.enum(["EINGANG", "AUSGANG"]),
  reference: optionalStr,
});

export const mandateSchema = z.object({
  personId: z.string().min(1),
  iban: z.string().trim().min(1),
  mandateRef: z.string().trim().min(1),
  signedDate: z.coerce.date(),
});

// month als "YYYY-MM"
export const generateSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

export const costEntrySchema = z.object({
  propertyId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  type: z.enum([
    "GRUNDSTEUER", "WASSER", "ENTWAESSERUNG", "HEIZUNG", "WARMWASSER", "AUFZUG",
    "STRASSENREINIGUNG", "MUELL", "GEBAEUDEREINIGUNG", "GARTENPFLEGE", "BELEUCHTUNG",
    "SCHORNSTEIN", "VERSICHERUNG", "HAUSWART", "KABEL", "SONSTIGE",
  ]),
  amount: z.coerce.number().nonnegative(),
  method: z.enum(["AREA", "UNITS", "PERSONS", "CONSUMPTION", "MEA"]),
  umlagefaehig: z.enum(["true", "false"]).transform((v) => v === "true"),
  note: optionalStr,
});

export const ownerSchema = z.object({
  personId: z.string().min(1),
  unitId: z.string().min(1),
  share: z.coerce.number().int().positive(),
});

export const economicPlanSchema = z.object({
  propertyId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  totalAmount: z.coerce.number().nonnegative(),
  note: optionalStr,
});

export const reserveSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().trim().min(1),
});

export const reserveTxSchema = z.object({
  reserveId: z.string().min(1),
  date: z.coerce.date(),
  amount: z.coerce.number(),
  note: optionalStr,
});

export const meetingCreateSchema = z.object({
  propertyId: z.string().min(1),
  title: z.string().trim().min(1),
  date: z.coerce.date(),
  location: optionalStr,
  status: z.enum(["GEPLANT", "DURCHGEFUEHRT"]),
});

export const meetingUpdateSchema = z.object({
  title: z.string().trim().min(1),
  date: z.coerce.date(),
  location: optionalStr,
  status: z.enum(["GEPLANT", "DURCHGEFUEHRT"]),
  protocol: optionalStr,
});

export const agendaSchema = z.object({
  meetingId: z.string().min(1),
  title: z.string().trim().min(1),
  description: optionalStr,
});

export const taskSchema = z.object({
  title: z.string().trim().min(1),
  dueDate: optionalDate,
});

export const appointmentSchema = z.object({
  title: z.string().trim().min(1),
  type: z.enum(["BESICHTIGUNG", "VERSAMMLUNG", "WARTUNG", "FRIST", "SONSTIGES"]),
  start: z.coerce.date(),
  end: optionalDate,
  location: optionalStr,
  propertyId: optionalStr,
  note: optionalStr,
});

export const emailSchema = z.object({
  toAddress: z.string().trim().email(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

export const userCreateSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "VERWALTER", "BUCHHALTUNG", "BEIRAT", "EIGENTUEMER", "MIETER", "HANDWERKER"]),
  personId: optionalStr,
});

export const contractorSchema = z.object({
  name: z.string().trim().min(1),
  trade: z.string().trim().min(1),
  email: optionalStr,
  phone: optionalStr,
});

const ticketBase = {
  title: z.string().trim().min(1),
  description: optionalStr,
  priority: z.enum(["NIEDRIG", "MITTEL", "HOCH"]),
  propertyId: optionalStr,
  unitId: optionalStr,
  contractorId: optionalStr,
};

export const ticketCreateSchema = z.object(ticketBase);
export const ticketUpdateSchema = z.object({
  ...ticketBase,
  status: z.enum(["OFFEN", "IN_ARBEIT", "ERLEDIGT"]),
});

export const maintenanceSchema = z.object({
  propertyId: z.string().min(1),
  contractorId: optionalStr,
  title: z.string().trim().min(1),
  intervalMonths: z.coerce.number().int().positive(),
  nextDue: z.coerce.date(),
  note: optionalStr,
});

export const resolutionSchema = z.object({
  propertyId: z.string().min(1),
  meetingId: optionalStr,
  title: z.string().trim().min(1),
  text: z.string().trim().min(1),
  date: z.coerce.date(),
  result: z.enum(["ANGENOMMEN", "ABGELEHNT", "VERTAGT"]),
  votesYes: z.coerce.number().int().min(0),
  votesNo: z.coerce.number().int().min(0),
  votesAbstain: z.coerce.number().int().min(0),
});
