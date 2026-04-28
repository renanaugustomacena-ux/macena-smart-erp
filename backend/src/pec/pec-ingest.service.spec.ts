import { PecIngestService } from './pec-ingest.service';
import type { PecMailbox, PecMessage } from './pec-mailbox';

const VALID_FATTURAPA = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPA12">
  <FatturaElettronicaHeader>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>12345678901</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>Fornitore Esempio S.r.l.</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>09876543210</IdCodice>
        </IdFiscaleIVA>
      </DatiAnagrafici>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>2026-04-28</Data>
        <Numero>2026/0042</Numero>
        <ImportoTotaleDocumento>122.00</ImportoTotaleDocumento>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <Descrizione>Servizio di consulenza</Descrizione>
        <Quantita>1.00</Quantita>
        <PrezzoUnitario>100.00</PrezzoUnitario>
        <PrezzoTotale>100.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>22.00</AliquotaIVA>
        <ImponibileImporto>100.00</ImponibileImporto>
        <Imposta>22.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

const MALFORMED_FATTURAPA = `<?xml version="1.0"?><junk/>`;

class FakeMailbox implements PecMailbox {
  public seen: string[] = [];
  constructor(private messages: PecMessage[]) {}
  async listUnseen(_limit?: number): Promise<PecMessage[]> {
    return this.messages;
  }
  async markSeen(messageId: string): Promise<void> {
    this.seen.push(messageId);
  }
}

function pecMessage(
  id: string,
  attachments: Array<{ filename: string; mimeType: string; body: Buffer }>,
): PecMessage {
  return {
    messageId: id,
    from: 'sdi01@pec.fatturapa.it',
    to: 'tenant@pec.example.it',
    subject: 'IT12345678901_00001',
    receivedAt: '2026-04-28T10:00:00Z',
    attachments,
  };
}

describe('PecIngestService.listFatturaPaCandidates (S14.4)', () => {
  const svc = new PecIngestService();

  it('emits one candidate per valid attachment', async () => {
    const mailbox = new FakeMailbox([
      pecMessage('msg-1', [
        {
          filename: 'IT12345678901_00001.xml',
          mimeType: 'application/xml',
          body: Buffer.from(VALID_FATTURAPA, 'utf8'),
        },
      ]),
    ]);
    const summary = await svc.listFatturaPaCandidates('tenant-1', mailbox);
    expect(summary.tenantId).toBe('tenant-1');
    expect(summary.inspectedMessages).toBe(1);
    expect(summary.candidates).toHaveLength(1);
    expect(summary.errors).toHaveLength(0);
    const c = summary.candidates[0];
    expect(c.pecMessageId).toBe('msg-1');
    expect(c.filename).toBe('IT12345678901_00001.xml');
    expect(c.parsed.invoiceNumber).toBe('2026/0042');
    expect(c.parsed.totalCents).toBe(12_200);
  });

  it('emits a structured error per malformed attachment', async () => {
    const mailbox = new FakeMailbox([
      pecMessage('msg-2', [
        {
          filename: 'IT12345678901_00002.xml',
          mimeType: 'application/xml',
          body: Buffer.from(MALFORMED_FATTURAPA, 'utf8'),
        },
      ]),
    ]);
    const summary = await svc.listFatturaPaCandidates('tenant-1', mailbox);
    expect(summary.candidates).toHaveLength(0);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].errorCode).toBe('missing_mandatory');
  });

  it('flags signed .xml.p7m attachments with p7m_unwrap_not_implemented', async () => {
    const mailbox = new FakeMailbox([
      pecMessage('msg-3', [
        {
          filename: 'IT12345678901_00003.xml.p7m',
          mimeType: 'application/pkcs7-mime',
          body: Buffer.from('binary-cms-blob'),
        },
      ]),
    ]);
    const summary = await svc.listFatturaPaCandidates('tenant-1', mailbox);
    expect(summary.candidates).toHaveLength(0);
    expect(summary.errors[0].errorCode).toBe('p7m_unwrap_not_implemented');
  });

  it('ignores non-FatturaPA attachments without erroring', async () => {
    const mailbox = new FakeMailbox([
      pecMessage('msg-4', [
        {
          filename: 'random.pdf',
          mimeType: 'application/pdf',
          body: Buffer.from('PDF blob'),
        },
      ]),
    ]);
    const summary = await svc.listFatturaPaCandidates('tenant-1', mailbox);
    expect(summary.candidates).toHaveLength(0);
    expect(summary.errors).toHaveLength(0);
    expect(summary.inspectedMessages).toBe(1);
  });

  it('does NOT mark any message seen — caller decides per-candidate ack', async () => {
    const mailbox = new FakeMailbox([
      pecMessage('msg-5', [
        {
          filename: 'IT12345678901_00005.xml',
          mimeType: 'application/xml',
          body: Buffer.from(VALID_FATTURAPA, 'utf8'),
        },
      ]),
    ]);
    await svc.listFatturaPaCandidates('tenant-1', mailbox);
    expect(mailbox.seen).toEqual([]);
  });

  it('handles a mailbox with multiple messages and mixed outcomes', async () => {
    const mailbox = new FakeMailbox([
      pecMessage('msg-A', [
        {
          filename: 'IT12345678901_AAAAA.xml',
          mimeType: 'application/xml',
          body: Buffer.from(VALID_FATTURAPA, 'utf8'),
        },
      ]),
      pecMessage('msg-B', [
        {
          filename: 'IT12345678901_BBBBB.xml',
          mimeType: 'application/xml',
          body: Buffer.from(MALFORMED_FATTURAPA, 'utf8'),
        },
      ]),
      pecMessage('msg-C', [
        {
          filename: 'invoice.pdf',
          mimeType: 'application/pdf',
          body: Buffer.from('PDF'),
        },
      ]),
    ]);
    const summary = await svc.listFatturaPaCandidates('tenant-1', mailbox);
    expect(summary.candidates).toHaveLength(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.inspectedMessages).toBe(3);
  });
});
