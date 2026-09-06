import { describe, it, expect, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "./crypto";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-crypto";
});

describe("encryptSecret/decryptSecret", () => {
  it("roundtrip", () => {
    const plain = "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----";
    const enc = encryptSecret(plain);
    expect(enc.startsWith("v1:")).toBe(true);
    expect(enc).not.toContain("abc123");
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("verschiedene IVs je Aufruf", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  it("manipuliertes Ciphertext wirft (GCM-Tag)", () => {
    const enc = encryptSecret("geheim");
    const broken = "v1:" + Buffer.from("00".repeat(40), "hex").toString("base64");
    expect(() => decryptSecret(broken)).toThrow();
  });
});
