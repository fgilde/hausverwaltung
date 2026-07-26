import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Listet alle Hintergrundvideos aus public/videos/ (mp4/webm).
 * Einfach weitere Dateien dort ablegen — sie rotieren automatisch.
 */
export async function listBackgroundVideos(): Promise<string[]> {
  try {
    const dir = path.join(process.cwd(), "public", "videos");
    const files = await fs.readdir(dir);
    return files
      .filter((f) => /\.(mp4|webm)$/i.test(f))
      .sort()
      .map((f) => `/videos/${f}`);
  } catch {
    return [];
  }
}
