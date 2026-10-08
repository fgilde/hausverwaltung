// Pingen API v2 (#58): Briefe hochladen, drucken und versenden lassen.
// Doku: https://api.pingen.com/documentation — Ablauf: Token (client_credentials),
// Upload-URL holen, PDF per PUT hochladen, Brief anlegen (auto_send). Die Anschrift
// liest Pingen aus dem Adressfeld des PDFs (address_position "left").

export type PingenConfig = { clientId: string; clientSecret: string; orgId?: string | null; staging?: boolean };
export type PingenOptions = { color?: boolean; duplex?: boolean; product?: "cheap" | "fast" | "registered" };

const hosts = (staging?: boolean) =>
  staging
    ? { api: "https://api-staging.pingen.com", id: "https://identity-staging.pingen.com" }
    : { api: "https://api.pingen.com", id: "https://identity.pingen.com" };

async function check(res: Response, what: string) {
  if (res.ok) return res;
  const text = await res.text().catch(() => "");
  let detail = text.slice(0, 300);
  try {
    const j = JSON.parse(text);
    detail = j.errors?.[0]?.detail || j.errors?.[0]?.title || j.error_description || j.message || detail;
  } catch {}
  throw new Error(`Pingen ${what}: ${res.status} ${detail}`.trim());
}

async function token(cfg: PingenConfig): Promise<string> {
  const res = await fetch(`${hosts(cfg.staging).id}/auth/access-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: "letter organisation_read",
    }),
  });
  return ((await (await check(res, "Anmeldung")).json()) as { access_token: string }).access_token;
}

async function api<T>(cfg: PingenConfig, tok: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(hosts(cfg.staging).api + path, {
    method,
    headers: {
      Authorization: `Bearer ${tok}`,
      Accept: "application/vnd.api+json",
      ...(body ? { "Content-Type": "application/vnd.api+json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return (await (await check(res, `${method} ${path.split("?")[0]}`)).json()) as T;
}

type Org = { data: { id: string; attributes: { name?: string } }[] };

/** Organisation des Kontos: konfigurierte ID oder die erste. */
async function org(cfg: PingenConfig, tok: string): Promise<{ id: string; name: string }> {
  const orgs = await api<Org>(cfg, tok, "GET", "/organisations");
  const o = cfg.orgId ? orgs.data.find((x) => x.id === cfg.orgId) : orgs.data[0];
  if (!o) throw new Error(cfg.orgId ? "Pingen: Organisation nicht gefunden" : "Pingen: keine Organisation im Konto");
  return { id: o.id, name: o.attributes?.name ?? o.id };
}

/** Zugang prüfen; liefert die Organisation (für die Einstellungen). */
export async function pingenPing(cfg: PingenConfig) {
  return org(cfg, await token(cfg));
}

/** Body für „Brief anlegen“ (JSON:API). */
export function pingenLetterBody(file: { url: string; signature: string; name: string }, o: PingenOptions) {
  return {
    data: {
      type: "letters",
      attributes: {
        file_original_name: file.name,
        file_url: file.url,
        file_url_signature: file.signature,
        address_position: "left",
        auto_send: true,
        delivery_product: o.product ?? "cheap",
        print_mode: o.duplex ? "duplex" : "simplex",
        print_spectrum: o.color ? "color" : "grayscale",
      },
    },
  };
}

type LetterRes = { data: { id: string; attributes: { status?: string } } };

/** Brief hochladen und versenden. Liefert Pingen-Brief-ID, Organisation und Status. */
export async function pingenSend(cfg: PingenConfig, pdf: Buffer, fileName: string, o: PingenOptions) {
  const tok = await token(cfg);
  const { id: orgId } = await org(cfg, tok);
  const up = await api<{ data: { attributes: { url: string; url_signature: string } } }>(cfg, tok, "GET", "/file-upload");
  // Upload direkt in den Speicher von Pingen: roher PUT, ohne Authorization
  await check(await fetch(up.data.attributes.url, { method: "PUT", body: new Uint8Array(pdf) }), "Upload");
  const body = pingenLetterBody({ url: up.data.attributes.url, signature: up.data.attributes.url_signature, name: fileName }, o);
  const res = await api<LetterRes>(cfg, tok, "POST", `/organisations/${orgId}/deliveries/letters`, body);
  return { id: res.data.id, orgId, status: res.data.attributes?.status ?? "validating" };
}

export async function pingenStatus(cfg: PingenConfig, letterId: string) {
  const tok = await token(cfg);
  const { id: orgId } = await org(cfg, tok);
  const res = await api<LetterRes>(cfg, tok, "GET", `/organisations/${orgId}/deliveries/letters/${letterId}`);
  return res.data.attributes?.status ?? "";
}

// Pingen liefert den Status als freien Text (keine vollständige Liste laut Doku).
const PINGEN_FAILED = ["cancelled", "cancelled_expired", "expired", "invalid", "rejected", "undeliverable", "unprintable"];

/** Pingen-Status → HaVeWa-Briefstatus. Unbekanntes = noch in Bearbeitung. */
export function mapPingenStatus(s: string): "EINGEREICHT" | "VERSENDET" | "ZUGESTELLT" | "FEHLER" {
  if (s === "sent") return "VERSENDET";
  if (s === "delivered") return "ZUGESTELLT";
  if (PINGEN_FAILED.includes(s)) return "FEHLER";
  return "EINGEREICHT";
}
