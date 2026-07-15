// Mail-Versand-Adapter. Analog zu lib/storage.ts gekapselt: nur diese Datei
// tauschen, um einen echten Transport (SMTP/Provider-API) anzubinden.
//
// ponytail: kein SMTP-Client eingebunden. Ist SMTP_HOST gesetzt, würde hier der
// tatsächliche Versand laufen (nodemailer o. Provider-API) — Upgrade-Pfad, wenn
// echter Mailversand gebraucht wird. Ohne Konfiguration arbeitet der Postausgang
// als lokale Queue: Nachrichten werden erfasst und als „gesendet" markiert.

export function isMailerConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

export interface OutgoingMail {
  to: string;
  subject: string;
  body: string;
}

/**
 * Versendet eine Mail über den konfigurierten Transport.
 * Wirft bei konfiguriertem, aber fehlerhaftem Versand — Aufrufer fängt und
 * setzt den Status auf FEHLER. Ohne Konfiguration: no-op (lokale Queue).
 */
export async function sendMail(_mail: OutgoingMail): Promise<void> {
  if (!isMailerConfigured()) return; // lokale Queue, kein echter Versand
  // ponytail: echten SMTP-/Provider-Versand hier anbinden.
  throw new Error("SMTP_HOST gesetzt, aber kein Transport implementiert (ponytail-Ceiling)");
}
