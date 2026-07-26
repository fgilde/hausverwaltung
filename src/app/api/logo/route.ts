import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET() {
  // Angemeldet: Logo des eigenen Mandanten. Unangemeldet (Login-Seite):
  // Logo des (ersten) Mandanten — für das Branding vor der Anmeldung.
  const session = await auth();
  const tenant = session?.user
    ? await prisma.tenant.findUnique({ where: { id: session.user.tenantId }, select: { logoKey: true } })
    : await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" }, select: { logoKey: true } });
  if (!tenant?.logoKey) return new Response("Not found", { status: 404 });

  try {
    const buf = await readFile(tenant.logoKey);
    const ext = tenant.logoKey.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
