// Deutsche Post E-POSTBUSINESS API (#58): Hybridbrief — PDF hochladen, die Post
// druckt, kuvertiert und versendet. Doku: https://api.epost.docuguide.com/swagger
// Login mit Vendor-ID, EKP, Passwort und Secret (aus der Freischaltung per SMS-TAN).
// Die Anschrift muss im PDF-Fenster stehen UND identisch als Felder mitgeschickt werden.

const BASE = "https://api.epost.docuguide.com";

export type EpostConfig = { vendorId: string; ekp: string; password: string; secret: string; test?: boolean };
export type EpostOptions = { color?: boolean; duplex?: boolean; registered?: "Einwurf Einschreiben" | "Einschreiben" | "Einschreiben Rückschein" | null };

async function check(res: Response, what: string) {
  if (res.ok) return res;
  const text = await res.text().catch(() => "");
  let detail = text.slice(0, 300);
  try {
    const j = JSON.parse(text);
    detail = j.title || j.message || j.detail || (Array.isArray(j) ? j.map((e) => e.errorMessage ?? e).join("; ") : "") || detail;
  } catch {}
  throw new Error(`E-POST ${what}: ${res.status} ${detail}`.trim());
}

async function login(cfg: EpostConfig): Promise<string> {
  const res = await fetch(`${BASE}/api/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vendorID: cfg.vendorId, ekp: cfg.ekp, secret: cfg.secret, password: cfg.password, tokenDuration: 60 }),
  });
  const j = (await (await check(res, "Anmeldung")).json()) as { token?: string };
  if (!j.token) throw new Error("E-POST Anmeldung: kein Token erhalten");
  return j.token;
}

/** Zugang prüfen (Login). */
export async function epostPing(cfg: EpostConfig) {
  await login(cfg);
  return true;
}

export type EpostAddress = { lines: string[]; zip: string; city: string; country: string };

/**
 * Anschriftzeilen → Felder der API: Zeilen vor „PLZ Ort“ = addressLine1..5,
 * eine Zeile danach = Land (Deutschland → leer, sonst in Großbuchstaben).
 */
export function splitAddress(recipient: string[]): EpostAddress | null {
  const lines = recipient.map((l) => l.trim()).filter(Boolean);
  const i = lines.findIndex((l) => /^(?:D-)?\d{4,5}\s+\S/.test(l));
  if (i < 1) return null;
  const m = /^(?:D-)?(\d{4,5})\s+(.+)$/.exec(lines[i])!;
  const country = (lines[i + 1] ?? "").toUpperCase();
  return { lines: lines.slice(0, i).slice(0, 5), zip: m[1], city: m[2], country: country === "DEUTSCHLAND" ? "" : country };
}

/** Request-Body für „Brief senden“ (die API erwartet immer ein Array). */
export function epostLetterBody(
  cfg: Pick<EpostConfig, "test">,
  pdf: Buffer,
  fileName: string,
  addr: EpostAddress,
  o: EpostOptions,
  extra: { testEmail?: string; custom?: string } = {},
) {
  const address: Record<string, string> = {};
  addr.lines.forEach((l, i) => (address[`addressLine${i + 1}`] = l));
  return [
    {
      fileName,
      data: pdf.toString("base64"),
      isColor: !!o.color,
      isDuplex: !!o.duplex,
      registeredLetter: o.registered ?? null,
      testFlag: !!cfg.test,
      ...(cfg.test && extra.testEmail ? { testEMail: extra.testEmail, testShowRestrictedArea: true } : {}),
      ...address,
      zipCode: addr.zip,
      city: addr.city,
      country: addr.country,
      activateDuplicateFailsafe: true,
      ...(extra.custom ? { custom1: extra.custom } : {}),
    },
  ];
}

export async function epostSend(
  cfg: EpostConfig,
  pdf: Buffer,
  fileName: string,
  addr: EpostAddress,
  o: EpostOptions,
  extra: { testEmail?: string; custom?: string } = {},
) {
  const tok = await login(cfg);
  const res = await fetch(`${BASE}/api/Letter`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify(epostLetterBody(cfg, pdf, fileName, addr, o, extra)),
  });
  const j = (await (await check(res, "Versand")).json()) as { letterID?: number }[];
  const id = j?.[0]?.letterID;
  if (!id) throw new Error("E-POST Versand: keine Brief-ID erhalten");
  return { id: String(id) };
}

type EpostStatus = { statusID?: number; statusDetails?: string; errorList?: { errorMessage?: string }[] };

export async function epostStatus(cfg: EpostConfig, letterId: string) {
  const tok = await login(cfg);
  const res = await fetch(`${BASE}/api/Letter/${encodeURIComponent(letterId)}`, { headers: { Authorization: `Bearer ${tok}` } });
  const j = (await (await check(res, "Status")).json()) as EpostStatus;
  const errors = (j.errorList ?? []).map((e) => e.errorMessage).filter(Boolean).join("; ");
  return { statusId: j.statusID ?? 0, text: errors || j.statusDetails || "" };
}

/** E-POST statusID → HaVeWa-Briefstatus (1 angenommen, 2 geprüft, 3 im Druckzentrum, 4 versendet, 99 Fehler). */
export function mapEpostStatus(id: number): "EINGEREICHT" | "VERSENDET" | "FEHLER" {
  if (id === 4) return "VERSENDET";
  if (id === 99) return "FEHLER";
  return "EINGEREICHT";
}
