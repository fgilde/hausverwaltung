import { describe, it, expect } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { buildJwt, mapTransaction } from "./enablebanking";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

describe("buildJwt", () => {
  const now = 1_700_000_000_000;
  const jwt = buildJwt("app-123", pem, now);
  const [h, b, s] = jwt.split(".");

  it("Header: RS256 + kid = Application-ID", () => {
    expect(decode(h)).toEqual({ typ: "JWT", alg: "RS256", kid: "app-123" });
  });

  it("Body: iss/aud/iat/exp (exp = iat + 1h, <= 24h)", () => {
    const body = decode(b);
    expect(body.iss).toBe("enablebanking.com");
    expect(body.aud).toBe("api.enablebanking.com");
    expect(body.iat).toBe(Math.floor(now / 1000));
    expect(body.exp - body.iat).toBe(3600);
    expect(body.exp - body.iat).toBeLessThanOrEqual(86400);
  });

  it("Signatur mit dem Private Key gültig", () => {
    const ok = createVerify("RSA-SHA256").update(`${h}.${b}`).end().verify(publicKey, Buffer.from(s, "base64url"));
    expect(ok).toBe(true);
  });
});

describe("mapTransaction", () => {
  it("Eingang (CRDT)", () => {
    expect(
      mapTransaction({
        transaction_amount: { amount: "850.00", currency: "EUR" },
        credit_debit_indicator: "CRDT",
        booking_date: "2026-02-15",
        remittance_information: ["Miete", "Februar"],
        entry_reference: "TX-1",
      }),
    ).toEqual({ externalId: "TX-1", amount: 850, direction: "EINGANG", date: "2026-02-15", reference: "Miete Februar" });
  });

  it("Ausgang (DBIT), Fallback value_date + transaction_id", () => {
    const m = mapTransaction({
      transaction_amount: { amount: "12.5" },
      credit_debit_indicator: "DBIT",
      value_date: "2026-03-01",
      transaction_id: "T2",
    });
    expect(m.direction).toBe("AUSGANG");
    expect(m.amount).toBe(12.5);
    expect(m.date).toBe("2026-03-01");
    expect(m.externalId).toBe("T2");
    expect(m.reference).toBeNull();
  });
});
