import {
  FatturaPaParseError,
  parseFatturaPa,
} from './fatturapa-passive-parser';

const SAMPLE_TD01 = `<?xml version="1.0" encoding="UTF-8"?>
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
        <Anagrafica>
          <Denominazione>Cliente Esempio S.r.l.</Denominazione>
        </Anagrafica>
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
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>Servizio di consulenza</Descrizione>
        <Quantita>1.00</Quantita>
        <UnitaMisura>pz</UnitaMisura>
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
    <DatiPagamento>
      <DettaglioPagamento>
        <DataScadenzaPagamento>2026-05-28</DataScadenzaPagamento>
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

describe('parseFatturaPa (S14.4 — pure logic)', () => {
  it('parses a clean TD01 single-line invoice', () => {
    const out = parseFatturaPa(SAMPLE_TD01);
    expect(out.documentType).toBe('TD01');
    expect(out.invoiceNumber).toBe('2026/0042');
    expect(out.invoiceDate).toBe('2026-04-28');
    expect(out.supplierVatNumber).toBe('12345678901');
    expect(out.customerVatNumber).toBe('09876543210');
    expect(out.currency).toBe('EUR');
    expect(out.subtotalCents).toBe(10_000);
    expect(out.taxCents).toBe(2_200);
    expect(out.totalCents).toBe(12_200);
    expect(out.paymentDueDate).toBe('2026-05-28');
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0]).toMatchObject({
      description: 'Servizio di consulenza',
      quantity: '1.00',
      unitOfMeasure: 'pz',
      unitCostCents: 10_000,
      lineTotalCents: 10_000,
      taxRate: 22,
    });
    expect(out.ivaBreakdown).toEqual([
      { rate: 22, taxableCents: 10_000, taxCents: 2_200, naturaCode: undefined },
    ]);
  });

  it('throws missing_mandatory when Numero is absent', () => {
    const xml = SAMPLE_TD01.replace('<Numero>2026/0042</Numero>', '');
    expect(() => parseFatturaPa(xml)).toThrow(FatturaPaParseError);
  });

  it('throws missing_mandatory when supplier IdCodice is absent', () => {
    const xml = SAMPLE_TD01.replace(
      '<IdCodice>12345678901</IdCodice>',
      '<IdCodice></IdCodice>',
    );
    try {
      parseFatturaPa(xml);
      fail('expected FatturaPaParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(FatturaPaParseError);
      expect((err as FatturaPaParseError).code).toBe('missing_mandatory');
    }
  });

  it('throws empty_body on empty input', () => {
    expect(() => parseFatturaPa('')).toThrow(/empty/);
  });

  it('handles namespace-prefixed tags', () => {
    const xml = SAMPLE_TD01.replace(/<Numero>/g, '<ns:Numero>')
      .replace(/<\/Numero>/g, '</ns:Numero>');
    const out = parseFatturaPa(xml);
    expect(out.invoiceNumber).toBe('2026/0042');
  });

  it('handles CDATA-wrapped textual content', () => {
    const xml = SAMPLE_TD01.replace(
      'Servizio di consulenza',
      '<![CDATA[Servizio & consulenza]]>',
    );
    const out = parseFatturaPa(xml);
    expect(out.lines[0].description).toBe('Servizio & consulenza');
  });

  it('parses multi-line invoices', () => {
    const xml = SAMPLE_TD01.replace(
      '</DettaglioLinee>',
      `</DettaglioLinee>
      <DettaglioLinee>
        <NumeroLinea>2</NumeroLinea>
        <Descrizione>Trasporto</Descrizione>
        <Quantita>1.00</Quantita>
        <UnitaMisura>pz</UnitaMisura>
        <PrezzoUnitario>50.00</PrezzoUnitario>
        <PrezzoTotale>50.00</PrezzoTotale>
        <AliquotaIVA>22.00</AliquotaIVA>
      </DettaglioLinee>`,
    );
    const out = parseFatturaPa(xml);
    expect(out.lines).toHaveLength(2);
    expect(out.subtotalCents).toBe(15_000);
  });

  it('captures Natura on a non-taxable line', () => {
    const xml = SAMPLE_TD01.replace(
      '<AliquotaIVA>22.00</AliquotaIVA>\n      </DettaglioLinee>',
      '<AliquotaIVA>0.00</AliquotaIVA>\n        <Natura>N4</Natura>\n      </DettaglioLinee>',
    );
    const out = parseFatturaPa(xml);
    expect(out.lines[0].naturaCode).toBe('N4');
  });

  it('falls back to subtotal+tax when ImportoTotaleDocumento is absent', () => {
    const xml = SAMPLE_TD01.replace(
      '<ImportoTotaleDocumento>122.00</ImportoTotaleDocumento>',
      '',
    );
    const out = parseFatturaPa(xml);
    expect(out.totalCents).toBe(12_200);
  });
});
