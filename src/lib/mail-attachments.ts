// Einheitliche Form für Mail-Anhänge (ein- wie ausgehend, #52). Eingehende
// Anhänge liegen zunächst nur an der Mail (documentId null) und werden erst per
// Klick als Dokument übernommen; ausgehende Anhänge sind immer Dokumente.

export type MailAttachment = { id: string; name: string; mime: string; documentId: string | null };

export function fromInbound(a: { id: string; name: string; mime: string; documentId: string | null }): MailAttachment {
  return { id: a.id, name: a.name, mime: a.mime, documentId: a.documentId };
}

export function fromOutbound(a: { document: { id: string; name: string; mime: string } }): MailAttachment {
  return { id: a.document.id, name: a.document.name, mime: a.document.mime, documentId: a.document.id };
}

/** Download-URL: übernommene Anhänge über das Dokument, sonst über den Anhang selbst. */
export function attachmentUrl(a: MailAttachment): string {
  return a.documentId ? `/api/documents/${a.documentId}` : `/api/inbound-attachments/${a.id}`;
}
