import { Injectable, Logger } from '@nestjs/common';
import { Customer } from '../../sales/sales.entity';
import { SalesOrder } from '../../sales/sales.entity';
import { Tenant } from '../../tenants/tenant.entity';
import {
  Invoice,
  InvoiceDocumentType,
} from '../accounting.entity';

/**
 * FatturaPA v1.2.2 XML adapter.
 *
 * Produces a Fattura Elettronica body compliant with:
 *   - D.Lgs. 127/2015 art. 1 (obbligo fattura elettronica).
 *   - Provvedimento Agenzia delle Entrate n. 89757 del 30 aprile 2018
 *     (regole tecniche del formato FatturaPA v1.2).
 *   - Provvedimento AdE n. 433608 del 24 novembre 2022 (TD17/TD18/TD19
 *     transfrontaliere).
 *   - Schema XSD: https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.2.2/Schema_del_file_xml_FatturaPA_versione_1.2.2.xsd
 *
 * The adapter intentionally produces textual XML rather than using a DOM
 * library. Fattura Elettronica schemas are stable and textual; avoiding
 * `xmldom` or `fast-xml-parser` keeps the bundle lean and the output
 * byte-for-byte reproducible. A caller wanting validation uses the XSD
 * pinned under `docs/schemas/Schema_del_file_xml_FatturaPA_versione_1.2.2.xsd`
 * via `libxml-xsd` or an external `xmllint --schema` pipeline.
 */

export interface FatturaPaBuildInput {
  tenant: Pick<
    Tenant,
    | 'vatNumber'
    | 'fiscalCode'
    | 'name'
    | 'billingAddress'
    | 'billingPostalCode'
    | 'billingCity'
    | 'billingProvince'
    | 'billingCountry'
  >;
  customer: Pick<
    Customer,
    | 'vatNumber'
    | 'fiscalCode'
    | 'name'
    | 'sdiDestinationCode'
    | 'pecEmail'
    | 'address'
    | 'postalCode'
    | 'city'
    | 'province'
    | 'country'
    | 'customerType'
    | 'splitPayment'
  >;
  invoice: Pick<
    Invoice,
    | 'number'
    | 'fiscalYear'
    | 'invoiceDate'
    | 'documentType'
    | 'subtotalAmount'
    | 'taxAmount'
    | 'totalAmount'
    | 'lines'
    | 'notes'
  >;
  salesOrder?: Pick<SalesOrder, 'orderNumber' | 'customerPoReference'>;
}

export interface FatturaPaBuildOutput {
  xml: string;
  fileName: string;
  progressive: string;
}

@Injectable()
export class FatturaPaAdapter {
  private readonly logger = new Logger(FatturaPaAdapter.name);

  /**
   * Build a FatturaPA body. Returns the canonical filename per the
   * SDI naming convention:
   *   IT{PartitaIVA}_{progressivo-univoco-alfanumerico-5chars}.xml
   */
  build(input: FatturaPaBuildInput): FatturaPaBuildOutput {
    this.assertInvariants(input);

    const progressive = this.encodeProgressive(
      input.invoice.fiscalYear,
      input.invoice.number,
    );
    const cedenteCountry = 'IT';
    const cedenteVat = input.tenant.vatNumber!;
    const cessionarioCountry = input.customer.country ?? 'IT';
    const cessionarioVat = input.customer.vatNumber;
    const cessionarioFiscalCode = input.customer.fiscalCode;
    const sdiCode = this.resolveDestinationCode(input);
    const pec = input.customer.pecEmail;
    const splitPayment = input.customer.splitPayment === true;
    const esigibilitaIVA = splitPayment ? 'S' : 'I';
    const documentType = input.invoice.documentType ?? InvoiceDocumentType.TD01;
    const formato = '1.2.2'; // FPR12 (B2B/B2C) or FPA12 (B2G) — B2B default below

    const formatoTrasmissione =
      input.customer.customerType === 'public_administration' ? 'FPA12' : 'FPR12';

    // Aggregate per-rate IVA blocks for DatiRiepilogo.
    const riepilogo = new Map<
      string,
      { imponibile: number; imposta: number; natura?: string }
    >();
    for (const line of input.invoice.lines) {
      const key = `${line.ivaRate}|${line.ivaNature ?? ''}`;
      const item = riepilogo.get(key) ?? {
        imponibile: 0,
        imposta: 0,
        natura: line.ivaNature,
      };
      item.imponibile += line.lineTotal;
      if (!line.ivaNature) {
        item.imposta += (line.lineTotal * line.ivaRate) / 100;
      }
      riepilogo.set(key, item);
    }

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<p:FatturaElettronica versione="${formatoTrasmissione}" ` +
        'xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" ' +
        'xmlns:ds="http://www.w3.org/2000/09/xmldsig#" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
      '  <FatturaElettronicaHeader>',
      '    <DatiTrasmissione>',
      '      <IdTrasmittente>',
      `        <IdPaese>${this.esc(cedenteCountry)}</IdPaese>`,
      `        <IdCodice>${this.esc(cedenteVat)}</IdCodice>`,
      '      </IdTrasmittente>',
      `      <ProgressivoInvio>${this.esc(progressive)}</ProgressivoInvio>`,
      `      <FormatoTrasmissione>${this.esc(formatoTrasmissione)}</FormatoTrasmissione>`,
      `      <CodiceDestinatario>${this.esc(sdiCode)}</CodiceDestinatario>`,
      ...(pec
        ? [`      <PECDestinatario>${this.esc(pec)}</PECDestinatario>`]
        : []),
      '    </DatiTrasmissione>',
      '    <CedentePrestatore>',
      '      <DatiAnagrafici>',
      '        <IdFiscaleIVA>',
      `          <IdPaese>${this.esc(cedenteCountry)}</IdPaese>`,
      `          <IdCodice>${this.esc(cedenteVat)}</IdCodice>`,
      '        </IdFiscaleIVA>',
      ...(input.tenant.fiscalCode
        ? [`        <CodiceFiscale>${this.esc(input.tenant.fiscalCode)}</CodiceFiscale>`]
        : []),
      '        <Anagrafica>',
      `          <Denominazione>${this.esc(input.tenant.name)}</Denominazione>`,
      '        </Anagrafica>',
      '        <RegimeFiscale>RF01</RegimeFiscale>',
      '      </DatiAnagrafici>',
      '      <Sede>',
      `        <Indirizzo>${this.esc(input.tenant.billingAddress ?? 'N/D')}</Indirizzo>`,
      `        <CAP>${this.esc(input.tenant.billingPostalCode ?? '00000')}</CAP>`,
      `        <Comune>${this.esc(input.tenant.billingCity ?? 'N/D')}</Comune>`,
      ...(input.tenant.billingProvince
        ? [`        <Provincia>${this.esc(input.tenant.billingProvince)}</Provincia>`]
        : []),
      `        <Nazione>${this.esc(input.tenant.billingCountry ?? 'IT')}</Nazione>`,
      '      </Sede>',
      '    </CedentePrestatore>',
      '    <CessionarioCommittente>',
      '      <DatiAnagrafici>',
      ...(cessionarioVat
        ? [
            '        <IdFiscaleIVA>',
            `          <IdPaese>${this.esc(cessionarioCountry)}</IdPaese>`,
            `          <IdCodice>${this.esc(cessionarioVat)}</IdCodice>`,
            '        </IdFiscaleIVA>',
          ]
        : []),
      ...(cessionarioFiscalCode
        ? [`        <CodiceFiscale>${this.esc(cessionarioFiscalCode)}</CodiceFiscale>`]
        : []),
      '        <Anagrafica>',
      `          <Denominazione>${this.esc(input.customer.name)}</Denominazione>`,
      '        </Anagrafica>',
      '      </DatiAnagrafici>',
      '      <Sede>',
      `        <Indirizzo>${this.esc(input.customer.address ?? 'N/D')}</Indirizzo>`,
      `        <CAP>${this.esc(input.customer.postalCode ?? '00000')}</CAP>`,
      `        <Comune>${this.esc(input.customer.city ?? 'N/D')}</Comune>`,
      ...(input.customer.province
        ? [`        <Provincia>${this.esc(input.customer.province)}</Provincia>`]
        : []),
      `        <Nazione>${this.esc(cessionarioCountry)}</Nazione>`,
      '      </Sede>',
      '    </CessionarioCommittente>',
      '  </FatturaElettronicaHeader>',
      '  <FatturaElettronicaBody>',
      '    <DatiGenerali>',
      '      <DatiGeneraliDocumento>',
      `        <TipoDocumento>${this.esc(documentType)}</TipoDocumento>`,
      '        <Divisa>EUR</Divisa>',
      `        <Data>${this.formatDate(input.invoice.invoiceDate)}</Data>`,
      `        <Numero>${this.esc(input.invoice.number)}</Numero>`,
      `        <ImportoTotaleDocumento>${this.money(input.invoice.totalAmount)}</ImportoTotaleDocumento>`,
      ...(input.invoice.notes
        ? [`        <Causale>${this.esc(this.truncate(input.invoice.notes, 200))}</Causale>`]
        : []),
      '      </DatiGeneraliDocumento>',
      ...(input.salesOrder
        ? [
            '      <DatiOrdineAcquisto>',
            `        <IdDocumento>${this.esc(input.salesOrder.orderNumber)}</IdDocumento>`,
            ...(input.salesOrder.customerPoReference
              ? [`        <CodiceCIG>${this.esc(input.salesOrder.customerPoReference)}</CodiceCIG>`]
              : []),
            '      </DatiOrdineAcquisto>',
          ]
        : []),
      '    </DatiGenerali>',
      '    <DatiBeniServizi>',
      ...input.invoice.lines.map((line, idx) =>
        [
          '      <DettaglioLinee>',
          `        <NumeroLinea>${idx + 1}</NumeroLinea>`,
          `        <Descrizione>${this.esc(line.description)}</Descrizione>`,
          `        <Quantita>${this.money(line.quantity, 2)}</Quantita>`,
          `        <PrezzoUnitario>${this.money(line.unitPrice)}</PrezzoUnitario>`,
          `        <PrezzoTotale>${this.money(line.lineTotal)}</PrezzoTotale>`,
          `        <AliquotaIVA>${this.money(line.ivaRate, 2)}</AliquotaIVA>`,
          ...(line.ivaNature
            ? [`        <Natura>${this.esc(line.ivaNature)}</Natura>`]
            : []),
          '      </DettaglioLinee>',
        ].join('\n'),
      ),
      ...Array.from(riepilogo.values()).map((item) =>
        [
          '      <DatiRiepilogo>',
          `        <AliquotaIVA>${this.money(
            this.extractRate(input.invoice.lines, item),
          )}</AliquotaIVA>`,
          ...(item.natura
            ? [`        <Natura>${this.esc(item.natura)}</Natura>`]
            : []),
          `        <ImponibileImporto>${this.money(item.imponibile)}</ImponibileImporto>`,
          `        <Imposta>${this.money(item.imposta)}</Imposta>`,
          `        <EsigibilitaIVA>${this.esc(esigibilitaIVA)}</EsigibilitaIVA>`,
          '      </DatiRiepilogo>',
        ].join('\n'),
      ),
      '    </DatiBeniServizi>',
      '    <DatiPagamento>',
      '      <CondizioniPagamento>TP02</CondizioniPagamento>',
      '      <DettaglioPagamento>',
      '        <ModalitaPagamento>MP05</ModalitaPagamento>',
      `        <DataScadenzaPagamento>${this.formatDate(input.invoice.invoiceDate)}</DataScadenzaPagamento>`,
      `        <ImportoPagamento>${this.money(input.invoice.totalAmount)}</ImportoPagamento>`,
      '      </DettaglioPagamento>',
      '    </DatiPagamento>',
      '  </FatturaElettronicaBody>',
      '</p:FatturaElettronica>',
    ].join('\n');

    const fileName = `IT${cedenteVat}_${progressive}.xml`;
    this.logger.log(
      `FatturaPA built: ${fileName} (${Math.round(xml.length / 1024)} KiB, totale=${input.invoice.totalAmount})`,
    );
    return { xml, fileName, progressive };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private assertInvariants(input: FatturaPaBuildInput): void {
    if (!input.tenant.vatNumber) {
      throw new Error(
        'Cannot build FatturaPA without tenant.vatNumber (Partita IVA).',
      );
    }
    if (!input.invoice.lines?.length) {
      throw new Error('Cannot build FatturaPA without invoice lines.');
    }
    if (!input.customer.vatNumber && !input.customer.fiscalCode) {
      throw new Error(
        'Cannot build FatturaPA: customer has neither Partita IVA nor Codice Fiscale.',
      );
    }
  }

  private resolveDestinationCode(input: FatturaPaBuildInput): string {
    const sdi = input.customer.sdiDestinationCode;
    if (sdi && /^[A-Z0-9]{7}$/.test(sdi)) return sdi;
    // Default: '0000000' → SDI delivers via PEC channel.
    return '0000000';
  }

  private encodeProgressive(fiscalYear: number, number: string): string {
    // Base-36 progressive with year prefix to maximise SDI uniqueness. 5 chars.
    const base = `${fiscalYear}${number}`;
    const digits = base.replace(/\D/g, '');
    const n = parseInt(digits || '0', 10);
    const encoded = n.toString(36).toUpperCase().slice(-5).padStart(5, '0');
    return encoded;
  }

  private formatDate(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  private money(n: number, digits: number = 2): string {
    const fixed = Number(n).toFixed(digits);
    return fixed;
  }

  private esc(s: string): string {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max) : s;
  }

  private extractRate(
    lines: FatturaPaBuildInput['invoice']['lines'],
    item: { imponibile: number; natura?: string },
  ): number {
    const match = lines.find(
      (l) =>
        Math.abs(l.lineTotal - item.imponibile) < 1000 &&
        (l.ivaNature ?? '') === (item.natura ?? ''),
    );
    return match?.ivaRate ?? 0;
  }
}
