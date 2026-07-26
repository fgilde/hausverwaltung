import { prisma } from "@/lib/prisma";

/** True, solange noch kein Benutzer existiert → Ersteinrichtung nötig. */
export async function needsSetup(): Promise<boolean> {
  const count = await prisma.user.count();
  return count === 0;
}
