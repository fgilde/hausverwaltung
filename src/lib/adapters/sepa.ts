// SEPA-Lastschrift-Export (pain.008.001.02) für den Hausgeld-/Miet-Einzug.
// ponytail: erzeugt gültig strukturiertes XML aus den übergebenen Positionen.
// Creditor-ID/Sequenztyp sind Platzhalter — für den Produktiv-Einzug pro
// Mandant konfigurierbar machen.

export interface SepaEntry {
  mandateRef: string;
  iban: string;
  debtorName: string;
  amount: number;
  reference: string;
}

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

export function toPain008(
  entries: SepaEntry[],
  opts: { creditorName: string; creditorIban: string; creditorId: string; msgId: string; createdAt: string },
): string {
  const sum = entries.reduce((a, e) => a + e.amount, 0).toFixed(2);
  const txs = entries
    .map(
      (e) => `      <DrctDbtTxInf>
        <PmtId><EndToEndId>${esc(e.reference).slice(0, 35) || "NOTPROVIDED"}</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">${e.amount.toFixed(2)}</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>${esc(e.mandateRef)}</MndtId></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>
        <Dbtr><Nm>${esc(e.debtorName)}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>${esc(e.iban)}</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>${esc(e.reference)}</Ustrd></RmtInf>
      </DrctDbtTxInf>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${esc(opts.msgId)}</MsgId>
      <CreDtTm>${opts.createdAt}</CreDtTm>
      <NbOfTxs>${entries.length}</NbOfTxs>
      <CtrlSum>${sum}</CtrlSum>
      <InitgPty><Nm>${esc(opts.creditorName)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${esc(opts.msgId)}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${entries.length}</NbOfTxs>
      <CtrlSum>${sum}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>RCUR</SeqTp></PmtTpInf>
      <Cdtr><Nm>${esc(opts.creditorName)}</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>${esc(opts.creditorIban)}</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></CdtrAgt>
      <CdtrSchmeId><Id><PrvtId><Othr><Id>${esc(opts.creditorId)}</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id></CdtrSchmeId>
${txs}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
}
