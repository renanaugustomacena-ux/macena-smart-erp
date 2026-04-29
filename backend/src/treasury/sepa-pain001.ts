/**
 * SEPA pain.001.001.09 builder (plan §31.2 Sprint 31).
 *
 * Generates a Customer Credit Transfer Initiation message (ISO 20022
 * pain.001.001.09 — the EBA Clearing 2024 schema). Used to instruct a
 * bank (or the tenant's commercialista) to disburse a batch of
 * payments. v1 emits the canonical XML shape; the Italian-CBI
 * dialectical extensions (CBI Banche pain.001) land alongside the
 * Sprint 32 reconciliation engine.
 */
export interface PainPayment {
  endToEndId: string;
  amountCents: number;
  currency: string;
  beneficiaryName: string;
  beneficiaryIban: string;
  beneficiaryBic?: string;
  remittanceInfo?: string;
  requestedExecutionDate: string;
}

export interface PainBatchInput {
  msgId: string;
  initiatorName: string;
  initiatorIban: string;
  initiatorBic?: string;
  payments: PainPayment[];
}

export function buildPain001(input: PainBatchInput): string {
  const totalCents = input.payments.reduce(
    (acc, p) => acc + Number(p.amountCents),
    0,
  );
  const totalEuro = (totalCents / 100).toFixed(2);
  const txs = input.payments
    .map((p) => {
      const amt = (Number(p.amountCents) / 100).toFixed(2);
      return `      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${escapeXml(p.endToEndId)}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="${escapeXml(p.currency)}">${amt}</InstdAmt>
        </Amt>
        <Cdtr>
          <Nm>${escapeXml(p.beneficiaryName)}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id><IBAN>${escapeXml(p.beneficiaryIban)}</IBAN></Id>
        </CdtrAcct>${p.beneficiaryBic ? `\n        <CdtrAgt><FinInstnId><BICFI>${escapeXml(p.beneficiaryBic)}</BICFI></FinInstnId></CdtrAgt>` : ''}${p.remittanceInfo ? `\n        <RmtInf><Ustrd>${escapeXml(p.remittanceInfo)}</Ustrd></RmtInf>` : ''}
      </CdtTrfTxInf>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${escapeXml(input.msgId)}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>${input.payments.length}</NbOfTxs>
      <CtrlSum>${totalEuro}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(input.initiatorName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(input.msgId)}-PI1</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${input.payments.length}</NbOfTxs>
      <CtrlSum>${totalEuro}</CtrlSum>
      <ReqdExctnDt><Dt>${input.payments[0]?.requestedExecutionDate ?? new Date().toISOString().slice(0, 10)}</Dt></ReqdExctnDt>
      <Dbtr>
        <Nm>${escapeXml(input.initiatorName)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id><IBAN>${escapeXml(input.initiatorIban)}</IBAN></Id>
      </DbtrAcct>${input.initiatorBic ? `\n      <DbtrAgt><FinInstnId><BICFI>${escapeXml(input.initiatorBic)}</BICFI></FinInstnId></DbtrAgt>` : ''}
${txs}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
