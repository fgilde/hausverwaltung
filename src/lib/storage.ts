import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Lokaler Datei-Speicher. ponytail: lokale Platte reicht; S3/Blob-Adapter,
// wenn Multi-Node oder Objektspeicher gebraucht wird.
const BASE = path.join(process.cwd(), "storage", "documents");

export async function saveFile(buffer: Buffer, originalName: string): Promise<string> {
  await fs.mkdir(BASE, { recursive: true });
  const ext = path.extname(originalName).slice(0, 12);
  const key = `${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(BASE, key), buffer);
  return key;
}

export async function readFile(key: string): Promise<Buffer> {
  // Path-Traversal verhindern: nur Basename zulassen.
  const safe = path.basename(key);
  return fs.readFile(path.join(BASE, safe));
}

export async function deleteFile(key: string): Promise<void> {
  const safe = path.basename(key);
  await fs.rm(path.join(BASE, safe), { force: true });
}
