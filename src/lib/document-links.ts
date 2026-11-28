// Vorgang, bei dem ein Dokument hinterlegt ist (#99): Mietvertrag, Ticket, Wartungsvertrag,
// Versicherung, Kostenposition oder Notiz (#89). Im Formular ein Feld "link" = "<art>:<id>".

export const DOCUMENT_LINKS = {
  lease: { column: "leaseId", model: "lease" },
  ticket: { column: "ticketId", model: "ticket" },
  maintenance: { column: "maintenanceContractId", model: "maintenanceContract" },
  insurance: { column: "insuranceId", model: "insurance" },
  cost: { column: "costEntryId", model: "costEntry" },
  note: { column: "noteId", model: "note" },
} as const;

export type DocumentLinkKind = keyof typeof DOCUMENT_LINKS;
export type DocumentLinkColumn = (typeof DOCUMENT_LINKS)[DocumentLinkKind]["column"];

export function parseDocumentLink(raw: string | null | undefined): { kind: DocumentLinkKind; id: string } | null {
  const m = /^([a-z]+):(.+)$/.exec((raw ?? "").trim());
  if (!m || !(m[1] in DOCUMENT_LINKS)) return null;
  return { kind: m[1] as DocumentLinkKind, id: m[2] };
}

/** Spaltenwerte für Prisma: der gewählte Vorgang, alle anderen gelöst. */
export function documentLinkData(link: { kind: DocumentLinkKind; id: string } | null): Record<DocumentLinkColumn, string | null> {
  const data = Object.fromEntries(Object.values(DOCUMENT_LINKS).map((d) => [d.column, null])) as Record<DocumentLinkColumn, string | null>;
  if (link) data[DOCUMENT_LINKS[link.kind].column] = link.id;
  return data;
}

/** Formularwert "<art>:<id>" eines Dokuments, "" ohne Vorgang. */
export function documentLinkOf(doc: Partial<Record<DocumentLinkColumn, string | null>>): string {
  for (const [kind, d] of Object.entries(DOCUMENT_LINKS)) {
    const id = doc[d.column];
    if (id) return `${kind}:${id}`;
  }
  return "";
}
