import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Symmetrische Verschlüsselung sensibler Secrets (z. B. Bank-Connector-Private-Key)
// at-rest in der DB. Schlüssel wird aus AUTH_SECRET abgeleitet (AES-256-GCM).
// Format: "v1:" + base64(iv[12] | tag[16] | ciphertext).

function key(): Buffer {
  const secret = process.env.AUTH_SECRET || "havewa-dev-secret-change-me";
  return scryptSync(secret, "havewa-secret-v1", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "v1:" + Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(enc: string): string {
  if (!enc.startsWith("v1:")) throw new Error("Unbekanntes Secret-Format");
  const raw = Buffer.from(enc.slice(3), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ct = raw.subarray(28);
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}
