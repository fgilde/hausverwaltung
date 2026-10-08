"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireWriter } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { encryptSecret } from "@/lib/crypto";
import { saveFile } from "@/lib/storage";
import type { ActionState } from "@/lib/schemas";
import { pingenPing } from "@/lib/adapters/pingen";
import { epostPing } from "@/lib/adapters/epost";
import { MAX_RECIPIENT_LINES } from "@/server/letter-pdf";
import {
  buildLetterPdf, submitLetter, refreshLetterStatus, letterProviders,
  type LetterProvider, type LetterOptions,
} from "@/server/letters";

// Briefe (#58): erstellen (PDF, DIN 5008), ablegen und per Pingen oder Deutscher Post versenden.

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function providerOf(fd: FormData): LetterProvider | null {
  const p = str(fd.get("provider"));
  return p === "PINGEN" || p === "EPOST" ? p : null;
}

/** Versandoptionen aus dem Formular; „Versandart“ wird je Anbieter übersetzt. */
function optionsOf(fd: FormData, provider: LetterProvider): LetterOptions {
  const mode = str(fd.get("mode")); // standard | fast | registered
  return {
    color: fd.get("color") === "on",
    duplex: fd.get("duplex") === "on",
    ...(provider === "PINGEN"
      ? { product: mode === "fast" ? "fast" : mode === "registered" ? "registered" : "cheap" }
      : { registered: mode === "registered" ? "Einwurf Einschreiben" : null }),
  };
}

async function send(tenantId: string, letterId: string, provider: LetterProvider, o: LetterOptions, testEmail?: string) {
  try {
    await submitLetter(tenantId, letterId, provider, o, testEmail);
    return null;
  } catch (e) {
    await prisma.letter.update({ where: { id: letterId }, data: { provider, status: "FEHLER", statusText: errMsg(e).slice(0, 500) } });
    return errMsg(e);
  }
}

export async function createLetter(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const recipient = str(fd.get("recipient")).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const subject = str(fd.get("subject"));
  const body = str(fd.get("body"));
  if (recipient.length < 2) return { error: "Bitte die vollständige Anschrift angeben (Name, Straße, PLZ Ort)" };
  if (recipient.length > MAX_RECIPIENT_LINES) return { error: `Die Anschrift darf höchstens ${MAX_RECIPIENT_LINES} Zeilen haben` };
  if (!subject || !body) return { error: "Betreff und Text sind Pflicht" };
  let personId: string | null = str(fd.get("personId")) || null;
  if (personId && !(await prisma.person.findFirst({ where: { id: personId, tenantId: user.tenantId }, select: { id: true } }))) personId = null;

  const pdf = await buildLetterPdf(user.tenantId, {
    recipient, subject, body, place: str(fd.get("place")), date: str(fd.get("date")),
  });
  const storageKey = await saveFile(pdf, ".pdf");
  const doc = await prisma.document.create({
    data: {
      tenantId: user.tenantId, personId, category: "BRIEF", mime: "application/pdf", size: pdf.length, storageKey,
      name: `Brief ${subject.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}.pdf`,
    },
  });
  const letter = await prisma.letter.create({
    data: { tenantId: user.tenantId, personId, recipient: recipient.join("\n"), subject, body, documentId: doc.id, sentById: user.id },
  });
  await audit(user, "CREATE", "Letter", letter.id, subject);

  const provider = providerOf(fd);
  const error = provider ? await send(user.tenantId, letter.id, provider, optionsOf(fd, provider), user.email ?? undefined) : null;
  revalidatePath("/", "layout");
  return error ? { error } : { ok: true };
}

/** Bereits erstellten Brief (Entwurf oder fehlgeschlagen) versenden. */
export async function sendLetter(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  const id = str(fd.get("id"));
  const provider = providerOf(fd);
  if (!provider) return { error: "Bitte einen Versandweg wählen" };
  const letter = await prisma.letter.findFirst({ where: { id, tenantId: user.tenantId }, select: { status: true } });
  if (!letter) return { error: "Brief nicht gefunden" };
  if (letter.status !== "ENTWURF" && letter.status !== "FEHLER") return { error: "Brief wurde bereits eingereicht" };
  const error = await send(user.tenantId, id, provider, optionsOf(fd, provider), user.email ?? undefined);
  await audit(user, "UPDATE", "Letter", id, `Versand ${provider}`);
  revalidatePath("/", "layout");
  return error ? { error } : { ok: true };
}

export async function refreshLetters(_p: ActionState, _fd: FormData): Promise<ActionState> {
  const user = await requireWriter();
  await refreshLetterStatus(user.tenantId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteLetter(fd: FormData): Promise<void> {
  const user = await requireWriter();
  const id = str(fd.get("id"));
  const res = await prisma.letter.deleteMany({ where: { id, tenantId: user.tenantId } });
  if (res.count > 0) await audit(user, "DELETE", "Letter", id);
  revalidatePath("/", "layout");
}

// --- Einstellungen: Zugangsdaten der Anbieter (nur Admin) ---

export async function updateLetterConfig(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const provider = providerOf(fd);
  // Secret-Felder: leer = unverändert lassen
  const secret = (field: string, column: string) => (str(fd.get(field)) ? { [column]: encryptSecret(str(fd.get(field))) } : {});
  if (provider === "PINGEN") {
    const clientId = str(fd.get("pingenClientId")) || null;
    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: clientId
        ? {
            pingenClientId: clientId,
            pingenOrgId: str(fd.get("pingenOrgId")) || null,
            pingenStaging: fd.get("pingenStaging") === "on",
            ...secret("pingenClientSecret", "pingenClientSecretEnc"),
          }
        : { pingenClientId: null, pingenClientSecretEnc: null, pingenOrgId: null }, // leere Client-ID = Pingen entfernen
    });
  } else if (provider === "EPOST") {
    const vendorId = str(fd.get("epostVendorId")) || null;
    const ekp = str(fd.get("epostEkp")) || null;
    if (ekp && !/^\d{10}$/.test(ekp)) return { error: "Die EKP ist 10-stellig" };
    await prisma.tenant.update({
      where: { id: user.tenantId },
      data: vendorId
        ? {
            epostVendorId: vendorId,
            epostEkp: ekp,
            epostTest: fd.get("epostTest") === "on",
            ...secret("epostPassword", "epostPasswordEnc"),
            ...secret("epostSecret", "epostSecretEnc"),
          }
        : { epostVendorId: null, epostEkp: null, epostPasswordEnc: null, epostSecretEnc: null },
    });
  } else return { error: "Unbekannter Anbieter" };
  await audit(user, "UPDATE", "Tenant", user.tenantId, `Briefversand ${provider}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function testLetterConfig(_p: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireRole(["ADMIN"]);
  const provider = providerOf(fd);
  const cfg = await letterProviders(user.tenantId);
  try {
    if (provider === "PINGEN") {
      if (!cfg.pingen) return { error: "Pingen ist nicht vollständig eingerichtet" };
      await pingenPing(cfg.pingen);
    } else if (provider === "EPOST") {
      if (!cfg.epost) return { error: "E-POST ist nicht vollständig eingerichtet" };
      await epostPing(cfg.epost);
    } else return { error: "Unbekannter Anbieter" };
    return { ok: true };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
