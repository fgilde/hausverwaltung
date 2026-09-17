import { redirect } from "next/navigation";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import * as eb from "@/lib/adapters/enablebanking";

// Rückleitung von der Bank nach dem Consent. Erstellt Session + verknüpft die
// Bankkonten mit (neu angelegten) HaVeWa-Konten.
export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const fail = (r: string) => redirect(`/finances?bank=${r}`);

  if (!code || !state) return fail("error");
  const pending = await prisma.bankAuthState.findUnique({ where: { state } });
  if (!pending || pending.tenantId !== user.tenantId) return fail("error");
  await prisma.bankAuthState.delete({ where: { state } }).catch(() => {});

  const row = await prisma.bankConnector.findUnique({ where: { tenantId: user.tenantId } });
  if (!row) return fail("error");
  const conn: eb.Connector = {
    applicationId: row.applicationId,
    privateKeyPem: decryptSecret(row.privateKeyEnc),
    baseUrl: row.baseUrl ?? undefined,
  };

  let session;
  try {
    session = await eb.createSession(conn, code);
  } catch {
    return fail("error");
  }

  for (const acc of session.accounts ?? []) {
    const uid = acc.uid;
    if (!uid) continue;
    if (await prisma.bankLink.findFirst({ where: { tenantId: user.tenantId, accountUid: uid }, select: { id: true } })) continue;
    const name = (acc.name as string) || `${pending.aspspName} ${uid.slice(0, 6)}`;
    // IBAN aus den Kontodetails übernehmen, falls die Schnittstelle sie liefert.
    const iban =
      typeof acc.account_id === "object" && acc.account_id
        ? ((acc.account_id as { iban?: string }).iban ?? null)
        : null;
    const account = await prisma.account.create({
      data: { tenantId: user.tenantId, name, type: "BANK", iban },
    });
    await prisma.bankLink.create({
      data: {
        tenantId: user.tenantId,
        connectorId: row.id,
        accountId: account.id,
        aspspName: pending.aspspName,
        aspspCountry: pending.aspspCountry,
        sessionId: session.session_id,
        accountUid: uid,
      },
    });
  }
  return fail("connected");
}
