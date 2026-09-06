import { createSign } from "node:crypto";

// Enable Banking (Open Banking Aggregator). Auth = selbst signiertes JWT (RS256)
// mit dem Application-Private-Key; kid = Application-ID. Doku:
// https://enablebanking.com/docs/api/reference/
// Reine Funktionen (buildJwt, mapTransaction) sind getestet; die HTTP-Calls
// liegen dünn darüber und werden gegen die Sandbox verifiziert.

const DEFAULT_BASE = "https://api.enablebanking.com";
const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

/** Signiertes API-JWT bauen (Gültigkeit 1 h, max. laut Doku 24 h). */
export function buildJwt(applicationId: string, privateKeyPem: string, nowMs: number = Date.now()): string {
  const iat = Math.floor(nowMs / 1000);
  const header = { typ: "JWT", alg: "RS256", kid: applicationId };
  const body = { iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp: iat + 3600 };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const sig = createSign("RSA-SHA256").update(input).end().sign(privateKeyPem);
  return `${input}.${b64url(sig)}`;
}

export type MappedTx = {
  externalId: string | null;
  amount: number;
  direction: "EINGANG" | "AUSGANG";
  date: string | null; // YYYY-MM-DD
  reference: string | null;
};

/** Enable-Banking-Transaktion → HaVeWa-Zahlungsfelder. */
export function mapTransaction(t: Record<string, unknown>): MappedTx {
  const ta = (t.transaction_amount ?? {}) as { amount?: string | number };
  const amount = Number(ta.amount ?? 0);
  const direction = t.credit_debit_indicator === "CRDT" ? "EINGANG" : "AUSGANG";
  const date = (t.booking_date as string) || (t.value_date as string) || null;
  const rem = t.remittance_information;
  const reference = Array.isArray(rem) ? rem.join(" ").trim() : typeof rem === "string" ? rem : null;
  const externalId = (t.entry_reference as string) || (t.transaction_id as string) || null;
  return { externalId, amount, direction, date, reference: reference || null };
}

// ---------- HTTP (gegen Sandbox zu verifizieren) ----------

export type Connector = { applicationId: string; privateKeyPem: string; baseUrl?: string };

async function api<T>(conn: Connector, method: string, path: string, body?: unknown): Promise<T> {
  const base = conn.baseUrl || DEFAULT_BASE;
  const res = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${buildJwt(conn.applicationId, conn.privateKeyPem)}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Enable Banking ${method} ${path}: ${res.status} ${text.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export function listAspsps(conn: Connector, country?: string) {
  return api<{ aspsps: { name: string; country: string }[] }>(
    conn,
    "GET",
    "/aspsps" + (country ? `?country=${country}` : ""),
  );
}

export function startAuth(
  conn: Connector,
  args: { aspspName: string; country: string; redirectUrl: string; state: string; psuType: string; validUntil: string },
) {
  return api<{ url: string; authorization_id: string }>(conn, "POST", "/auth", {
    aspsp: { name: args.aspspName, country: args.country },
    redirect_url: args.redirectUrl,
    psu_type: args.psuType,
    state: args.state,
    access: { valid_until: args.validUntil },
  });
}

export function createSession(conn: Connector, code: string) {
  return api<{ session_id: string; accounts: { uid: string; account_id?: unknown; name?: string }[] }>(
    conn,
    "POST",
    "/sessions",
    { code },
  );
}

export async function getTransactions(conn: Connector, accountUid: string, dateFrom?: string) {
  const q = dateFrom ? `?date_from=${dateFrom}` : "";
  const out: Record<string, unknown>[] = [];
  let path = `/accounts/${encodeURIComponent(accountUid)}/transactions${q}`;
  // Pagination via continuation_key.
  for (let i = 0; i < 50; i++) {
    const page = await api<{ transactions: Record<string, unknown>[]; continuation_key?: string }>(conn, "GET", path);
    out.push(...(page.transactions ?? []));
    if (!page.continuation_key) break;
    path = `/accounts/${encodeURIComponent(accountUid)}/transactions${q ? q + "&" : "?"}continuation_key=${encodeURIComponent(page.continuation_key)}`;
  }
  return out;
}
