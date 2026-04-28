/**
 * FatturaPA passive-cycle parser — pure logic (Sprint 14 / S14.4).
 *
 * Extracts the minimum field set the platform needs from an inbound
 * FatturaPA XML envelope (D.Lgs. 127/2015 + Provv. AdE 89757/2018,
 * schema v1.2.2) to populate `CreateSupplierInvoiceDto`.
 *
 * Why textual parsing instead of an XML DOM library:
 *   - The build adapter `accounting/fatturapa/fatturapa-adapter.ts`
 *     already produces FPA12 XML by string concatenation; the same
 *     stability assumptions apply to parsing the inbound side.
 *   - Keeps the bundle lean (no `xmldom`, no `fast-xml-parser`).
 *   - Byte-stable extraction makes hashing for conservazione consistent
 *     between sender and receiver.
 *
 * Live consumers (Sprint 24) MAY validate against the XSD pinned at
 * `docs/schemas/Schema_del_file_xml_FatturaPA_versione_1.2.2.xsd` via
 * `libxml-xsd` or an external `xmllint --schema` pipeline before
 * invoking this parser; the parser itself does not require a valid
 * envelope (it tolerates missing optional fields and surfaces
 * structured errors for missing mandatory fields).
 */

export interface ParsedFatturaPaLine {
  description: string;
  /** Decimal-string preserved as written in the XML. */
  quantity: string;
  unitOfMeasure: string;
  unitCostCents: number;
  lineTotalCents: number;
  taxRate: number;
  /** Optional Natura code for non-taxable lines (N1..N7). */
  naturaCode?: string;
}

export interface ParsedFatturaPaIvaBreakdownItem {
  rate: number;
  taxableCents: number;
  taxCents: number;
  naturaCode?: string;
}

export interface ParsedFatturaPa {
  /** FatturaPA `Numero` (caller maps to `supplierInvoiceNumber`). */
  invoiceNumber: string;
  /** FatturaPA `Data` (RFC 3339 date — `YYYY-MM-DD`). */
  invoiceDate: string;
  /** Supplier "CedentePrestatore" Partita IVA (11-digit) — used to resolve `supplierId`. */
  supplierVatNumber: string;
  /** Supplier denominazione (display name; fallback when supplier resolution by VAT fails). */
  supplierName: string;
  /** Customer "CessionarioCommittente" Partita IVA — checked against the receiving tenant. */
  customerVatNumber: string;
  /** Document type: TD01 = ordinary invoice; TD17/TD18/TD19 = TD-cross-border. */
  documentType: string;
  /** Header totals in cents. */
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** ISO-4217. */
  currency: string;
  /** Per-rate VAT breakdown (DatiRiepilogo). */
  ivaBreakdown: ParsedFatturaPaIvaBreakdownItem[];
  /** Lines (DettaglioLinee). */
  lines: ParsedFatturaPaLine[];
  /** Payment due date when present (DatiPagamento.DettaglioPagamento.DataScadenzaPagamento). */
  paymentDueDate?: string;
}

export class FatturaPaParseError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'FatturaPaParseError';
    this.code = code;
  }
}

/**
 * Parse a FatturaPA v1.2.2 envelope. Throws `FatturaPaParseError` with a
 * stable `code` for missing-mandatory-field errors so callers can
 * surface them as RFC 7807 Problem-Details with type-URI
 * `https://smarterp.it/errors/pec/fatturapa/<code>`.
 */
export function parseFatturaPa(xml: string): ParsedFatturaPa {
  if (!xml || typeof xml !== 'string') {
    throw new FatturaPaParseError('empty_body', 'FatturaPA body is empty.');
  }

  const invoiceNumber = first(xml, 'Numero');
  const invoiceDate = first(xml, 'Data');
  const documentType = first(xml, 'TipoDocumento') ?? 'TD01';
  const currency = first(xml, 'Divisa') ?? 'EUR';

  const supplierVatNumber = firstNested(xml, 'CedentePrestatore', 'IdCodice');
  const supplierName = firstNested(xml, 'CedentePrestatore', 'Denominazione');
  const customerVatNumber = firstNested(
    xml,
    'CessionarioCommittente',
    'IdCodice',
  );

  if (!invoiceNumber) throw mandatoryMissing('Numero');
  if (!invoiceDate) throw mandatoryMissing('Data');
  if (!supplierVatNumber)
    throw mandatoryMissing('CedentePrestatore.IdCodice');
  if (!customerVatNumber)
    throw mandatoryMissing('CessionarioCommittente.IdCodice');

  const ivaBreakdown = parseIvaBreakdown(xml);
  const lines = parseLines(xml);

  const subtotalCents = lines.reduce((s, l) => s + l.lineTotalCents, 0);
  const taxCents = ivaBreakdown.reduce((s, i) => s + i.taxCents, 0);
  // Prefer ImportoTotaleDocumento when present.
  const totalRaw = first(xml, 'ImportoTotaleDocumento');
  const totalCents = totalRaw
    ? toCents(totalRaw)
    : subtotalCents + taxCents;

  const paymentDueDate =
    firstNested(xml, 'DettaglioPagamento', 'DataScadenzaPagamento') ?? undefined;

  return {
    invoiceNumber: stripCdata(invoiceNumber),
    invoiceDate: invoiceDate.slice(0, 10),
    supplierVatNumber: stripCdata(supplierVatNumber),
    supplierName: supplierName ? stripCdata(supplierName) : '',
    customerVatNumber: stripCdata(customerVatNumber),
    documentType,
    subtotalCents,
    taxCents,
    totalCents,
    currency,
    ivaBreakdown,
    lines,
    paymentDueDate: paymentDueDate?.slice(0, 10),
  };
}

function mandatoryMissing(field: string): FatturaPaParseError {
  return new FatturaPaParseError(
    'missing_mandatory',
    `Mandatory FatturaPA field '${field}' not found.`,
  );
}

/** Parses each <DatiRiepilogo>...</DatiRiepilogo> block. */
function parseIvaBreakdown(xml: string): ParsedFatturaPaIvaBreakdownItem[] {
  const items: ParsedFatturaPaIvaBreakdownItem[] = [];
  const blocks = allBlocks(xml, 'DatiRiepilogo');
  for (const block of blocks) {
    const aliquota = first(block, 'AliquotaIVA');
    const imponibile = first(block, 'ImponibileImporto');
    const imposta = first(block, 'Imposta');
    const natura = first(block, 'Natura');
    items.push({
      rate: aliquota ? Math.round(Number(aliquota)) : 0,
      taxableCents: imponibile ? toCents(imponibile) : 0,
      taxCents: imposta ? toCents(imposta) : 0,
      naturaCode: natura ?? undefined,
    });
  }
  return items;
}

/** Parses each <DettaglioLinee>...</DettaglioLinee> block. */
function parseLines(xml: string): ParsedFatturaPaLine[] {
  const out: ParsedFatturaPaLine[] = [];
  const blocks = allBlocks(xml, 'DettaglioLinee');
  for (const block of blocks) {
    const description = first(block, 'Descrizione') ?? '';
    const quantity = first(block, 'Quantita') ?? '1';
    const unitOfMeasure = first(block, 'UnitaMisura') ?? 'pz';
    const unitCost = first(block, 'PrezzoUnitario') ?? '0';
    const lineTotal = first(block, 'PrezzoTotale') ?? '0';
    const aliquota = first(block, 'AliquotaIVA');
    const natura = first(block, 'Natura');
    out.push({
      description: stripCdata(description),
      quantity: stripCdata(quantity),
      unitOfMeasure: stripCdata(unitOfMeasure),
      unitCostCents: toCents(unitCost),
      lineTotalCents: toCents(lineTotal),
      taxRate: aliquota ? Math.round(Number(aliquota)) : 0,
      naturaCode: natura ? stripCdata(natura) : undefined,
    });
  }
  return out;
}

/** First textual content of `<tag>...</tag>` (namespace-tolerant). */
function first(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[\\w]+:)?${tag}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

/** First `<inner>...</inner>` inside the first `<outer>...</outer>` block. */
function firstNested(xml: string, outer: string, inner: string): string | null {
  const blocks = allBlocks(xml, outer);
  if (blocks.length === 0) return null;
  return first(blocks[0], inner);
}

/** Returns all textual contents matching `<tag>...</tag>`. */
function allBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(
    `<(?:[\\w]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[\\w]+:)?${tag}>`,
    'g',
  );
  const out: string[] = [];
  for (const m of xml.matchAll(re)) {
    out.push(m[1]);
  }
  return out;
}

function stripCdata(s: string): string {
  const m = s.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return (m ? m[1] : s).trim();
}

/**
 * FatturaPA monetary values are decimal strings with at most 2 decimal
 * places (or 8 for unit prices); we round to integer cents to fit
 * R-D04 (money in bigint cents).
 */
function toCents(decimalString: string): number {
  const n = Number(stripCdata(decimalString));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}
