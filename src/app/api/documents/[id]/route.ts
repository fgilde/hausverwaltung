import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const doc = await prisma.document.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!doc) return new Response("Not found", { status: 404 });

  const buf = await readFile(doc.storageKey);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.name)}"`,
    },
  });
}
