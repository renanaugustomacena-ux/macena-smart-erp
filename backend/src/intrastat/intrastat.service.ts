import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  IntrastatDeclaration,
  IntrastatDeclarationStatus,
  IntrastatDeclarationType,
  IntrastatLine,
  isIntraEuPartner,
} from './entities/intrastat-declaration.entity';
import {
  assertIntrastatTransition,
  canIntrastatTransition,
} from './state-machines/intrastat.fsm';
import { Customer } from '../sales/sales.entity';
import { Invoice } from '../accounting/accounting.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';

/**
 * IntrastatService — monthly INTRA-1bis (cessioni) and INTRA-2bis
 * (acquisti) aggregator + ADM CSV/XML export (plan §31.1 Sprint 16 /
 * S16.2).
 *
 * Compliance anchors:
 *   - Reg. UE 638/2004 + 2024/1148 — Intrastat data scope
 *   - Provv. AE 88406 del 25.09.2017 — Italian forms
 *   - Det. ADM 13799/RU del 19.04.2018 — telematic submission format
 *
 * The CSV is ADM tracciato-record-compatible (header + data rows in the
 * order the ADM template expects). The XML is a structured fallback; the
 * tenant submits either CSV or XML to the ADM Intrastat Web portal.
 */
@Injectable()
export class IntrastatService {
  private readonly logger = new Logger(IntrastatService.name);

  constructor(
    @InjectRepository(IntrastatDeclaration)
    private readonly declRepo: Repository<IntrastatDeclaration>,
    @InjectRepository(IntrastatLine)
    private readonly lineRepo: Repository<IntrastatLine>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(SupplierInvoice)
    private readonly supplierInvoiceRepo: Repository<SupplierInvoice>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Lifecycle ───────────────────────────────────────────────

  async createOrFindDraft(
    tenantId: string,
    type: IntrastatDeclarationType,
    periodYear: number,
    periodMonth: number,
  ): Promise<IntrastatDeclaration> {
    if (periodMonth < 1 || periodMonth > 12) {
      throw new BadRequestException('periodMonth must be 1..12');
    }
    const existing = await this.declRepo.findOne({
      where: { tenantId, type, periodYear, periodMonth },
    });
    if (existing) return existing;

    const draft = this.declRepo.create({
      tenantId,
      type,
      periodicity: 'monthly',
      periodYear,
      periodMonth,
      periodQuarter: null,
      status: 'draft',
      totalValueCents: 0,
      lineCount: 0,
    });
    return this.declRepo.save(draft);
  }

  async getDeclaration(
    tenantId: string,
    declarationId: string,
  ): Promise<IntrastatDeclaration & { lines: IntrastatLine[] }> {
    const decl = await this.declRepo.findOne({
      where: { tenantId, id: declarationId },
    });
    if (!decl) {
      throw new NotFoundException(
        `IntrastatDeclaration ${declarationId} not found`,
      );
    }
    const lines = await this.lineRepo.find({
      where: { tenantId, declarationId },
      order: { position: 'ASC' },
    });
    return { ...decl, lines };
  }

  async listDeclarations(
    tenantId: string,
    filters: {
      type?: IntrastatDeclarationType;
      year?: number;
      month?: number;
      status?: IntrastatDeclarationStatus;
    } = {},
  ): Promise<IntrastatDeclaration[]> {
    const qb = this.declRepo
      .createQueryBuilder('d')
      .where('d.tenantId = :tenantId', { tenantId });
    if (filters.type) qb.andWhere('d.type = :type', { type: filters.type });
    if (filters.year !== undefined)
      qb.andWhere('d.periodYear = :year', { year: filters.year });
    if (filters.month !== undefined)
      qb.andWhere('d.periodMonth = :month', { month: filters.month });
    if (filters.status)
      qb.andWhere('d.status = :status', { status: filters.status });
    qb.orderBy('d.periodYear', 'DESC')
      .addOrderBy('d.periodMonth', 'DESC')
      .addOrderBy('d.type', 'ASC');
    return qb.getMany();
  }

  // ─── Aggregation (S16.2) ─────────────────────────────────────

  /**
   * Build the candidate set of {@link IntrastatLine} rows for a draft
   * declaration. Pure; does not persist. The caller calls
   * {@link generate} to freeze the lines on the declaration record.
   */
  async aggregateLines(
    tenantId: string,
    type: IntrastatDeclarationType,
    periodYear: number,
    periodMonth: number,
  ): Promise<Array<Partial<IntrastatLine>>> {
    const fromDate = startOfMonth(periodYear, periodMonth);
    const toDate = startOfMonth(periodYear, periodMonth + 1);

    if (type === 'cessioni') {
      return this.aggregateCessioni(tenantId, fromDate, toDate);
    }
    return this.aggregateAcquisti(tenantId, fromDate, toDate);
  }

  private async aggregateCessioni(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<Array<Partial<IntrastatLine>>> {
    const invoices = await this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.tenantId = :tenantId', { tenantId })
      .andWhere('i.invoiceDate >= :fromDate', { fromDate })
      .andWhere('i.invoiceDate < :toDate', { toDate })
      .getMany();

    if (invoices.length === 0) return [];

    const customerIds = Array.from(
      new Set(invoices.map((i) => i.customerId).filter((id): id is string => !!id)),
    );
    if (customerIds.length === 0) return [];

    const customers = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.id IN (:...ids)', { ids: customerIds })
      .getMany();

    const customerById = new Map<string, Customer>(
      customers.map((c) => [c.id, c]),
    );

    const lines: Array<Partial<IntrastatLine>> = [];
    let position = 1;
    for (const inv of invoices) {
      const c = customerById.get(inv.customerId);
      if (!c) continue;
      if (!isIntraEuPartner(c.country)) continue;

      const valueCents = Math.round(Number(inv.totalAmount) * 100);
      lines.push({
        tenantId,
        position: position++,
        partnerCountry: (c.country ?? '').toUpperCase(),
        partnerVatNumber: c.vatNumber
          ? `${(c.country ?? '').toUpperCase()}${c.vatNumber}`
          : null,
        nc8Code: null,
        netMassKg: null,
        supplementaryUnits: null,
        valueCents,
        statisticalValueCents: valueCents,
        currency: 'EUR',
        // AE 88406/2017 default: "1 + 1" (sale → transfer of ownership).
        naturaTransazione: '11',
        modalitaTrasporto: null,
        regimeStatistico: null,
        paeseDestinazioneProvenienza: (c.country ?? '').toUpperCase(),
        paeseOrigine: null,
        sourceDocType: 'invoice',
        sourceDocId: inv.id,
      });
    }
    return lines;
  }

  private async aggregateAcquisti(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<Array<Partial<IntrastatLine>>> {
    const supplierInvoices = await this.supplierInvoiceRepo
      .createQueryBuilder('si')
      .where('si.tenantId = :tenantId', { tenantId })
      .andWhere('si.partnerCountry IS NOT NULL')
      .andWhere('si.supplierInvoiceDate >= :fromDate', { fromDate })
      .andWhere('si.supplierInvoiceDate < :toDate', { toDate })
      .getMany();

    const lines: Array<Partial<IntrastatLine>> = [];
    let position = 1;
    for (const si of supplierInvoices) {
      if (!isIntraEuPartner(si.partnerCountry)) continue;

      const valueCents = Number(si.totalCents);
      lines.push({
        tenantId,
        position: position++,
        partnerCountry: (si.partnerCountry ?? '').toUpperCase(),
        partnerVatNumber: si.partnerVatNumber,
        nc8Code: null,
        netMassKg: null,
        supplementaryUnits: null,
        valueCents,
        statisticalValueCents: valueCents,
        currency: 'EUR',
        naturaTransazione: '11',
        modalitaTrasporto: null,
        regimeStatistico: null,
        paeseDestinazioneProvenienza: (si.partnerCountry ?? '').toUpperCase(),
        paeseOrigine: (si.partnerCountry ?? '').toUpperCase(),
        sourceDocType: 'supplier_invoice',
        sourceDocId: si.id,
      });
    }
    return lines;
  }

  // ─── Generate / submit / accept / reject ─────────────────────

  async generate(
    tenantId: string,
    declarationId: string,
    actorUserId?: string,
  ): Promise<IntrastatDeclaration> {
    return this.dataSource.transaction(async (manager) => {
      const decl = await manager.findOne(IntrastatDeclaration, {
        where: { tenantId, id: declarationId },
      });
      if (!decl) {
        throw new NotFoundException(
          `IntrastatDeclaration ${declarationId} not found`,
        );
      }
      if (!canIntrastatTransition(decl.status, 'generated')) {
        throw new UnprocessableEntityException(
          `Cannot generate from status '${decl.status}'`,
        );
      }
      assertIntrastatTransition(decl.status, 'generated');

      // Re-aggregate fresh and replace any prior draft lines.
      const fresh = await this.aggregateLines(
        tenantId,
        decl.type,
        decl.periodYear,
        decl.periodMonth ?? 0,
      );
      await manager.delete(IntrastatLine, { tenantId, declarationId });
      const persisted: IntrastatLine[] = [];
      for (const candidate of fresh) {
        const line = manager.create(IntrastatLine, {
          ...candidate,
          declarationId,
        });
        persisted.push(await manager.save(line));
      }

      decl.status = 'generated';
      decl.generatedAt = new Date();
      decl.generatedBy = actorUserId ?? null;
      decl.totalValueCents = persisted.reduce(
        (acc, l) => acc + Number(l.valueCents),
        0,
      );
      decl.lineCount = persisted.length;
      return manager.save(decl);
    });
  }

  async submit(
    tenantId: string,
    declarationId: string,
    admProtocollo: string,
    actorUserId?: string,
  ): Promise<IntrastatDeclaration> {
    return this.transitionStatus(
      tenantId,
      declarationId,
      'submitted',
      (decl) => {
        if (!admProtocollo || admProtocollo.length === 0) {
          throw new BadRequestException(
            'admProtocollo is required to mark Intrastat declaration as submitted',
          );
        }
        decl.admProtocollo = admProtocollo;
        decl.submittedAt = new Date();
        decl.submittedBy = actorUserId ?? null;
      },
    );
  }

  async accept(
    tenantId: string,
    declarationId: string,
  ): Promise<IntrastatDeclaration> {
    return this.transitionStatus(tenantId, declarationId, 'accepted', (decl) => {
      decl.acceptedAt = new Date();
    });
  }

  async reject(
    tenantId: string,
    declarationId: string,
    reason: string,
  ): Promise<IntrastatDeclaration> {
    return this.transitionStatus(tenantId, declarationId, 'rejected', (decl) => {
      decl.rejectedAt = new Date();
      decl.rejectionReason = reason;
    });
  }

  async reopen(
    tenantId: string,
    declarationId: string,
  ): Promise<IntrastatDeclaration> {
    return this.transitionStatus(tenantId, declarationId, 'draft', (decl) => {
      decl.generatedAt = null;
      decl.totalValueCents = 0;
      decl.lineCount = 0;
    });
  }

  private async transitionStatus(
    tenantId: string,
    declarationId: string,
    next: IntrastatDeclarationStatus,
    apply: (decl: IntrastatDeclaration) => void,
  ): Promise<IntrastatDeclaration> {
    const decl = await this.declRepo.findOne({
      where: { tenantId, id: declarationId },
    });
    if (!decl) {
      throw new NotFoundException(
        `IntrastatDeclaration ${declarationId} not found`,
      );
    }
    if (!canIntrastatTransition(decl.status, next)) {
      throw new UnprocessableEntityException(
        `Invalid Intrastat transition: ${decl.status} → ${next}`,
      );
    }
    decl.status = next;
    apply(decl);
    return this.declRepo.save(decl);
  }

  // ─── Export ──────────────────────────────────────────────────

  async exportCsv(
    tenantId: string,
    declarationId: string,
  ): Promise<{ filename: string; body: string }> {
    const { type, periodYear, periodMonth, lines } = await this.getDeclaration(
      tenantId,
      declarationId,
    );
    const header = type === 'cessioni' ? CSV_HEADER_INTRA_1BIS : CSV_HEADER_INTRA_2BIS;
    const rows = lines.map((l) =>
      type === 'cessioni' ? csvRowIntra1Bis(l) : csvRowIntra2Bis(l),
    );
    const body =
      [header, ...rows].map((r) => r.join(';')).join('\r\n') + '\r\n';

    const filename = formatFilename(type, periodYear, periodMonth, 'csv');
    return { filename, body };
  }

  async exportXml(
    tenantId: string,
    declarationId: string,
  ): Promise<{ filename: string; body: string }> {
    const decl = await this.getDeclaration(tenantId, declarationId);
    const filename = formatFilename(
      decl.type,
      decl.periodYear,
      decl.periodMonth,
      'xml',
    );
    const body = renderIntrastatXml(decl);
    return { filename, body };
  }
}

// ─── CSV / XML helpers ─────────────────────────────────────────

const CSV_HEADER_INTRA_1BIS: ReadonlyArray<string> = [
  'Codice ISO Stato membro acquirente',
  'Codice IVA acquirente',
  'Ammontare delle operazioni in euro',
  'Codice nomenclatura combinata NC8',
  'Massa netta in kg',
  'Unita supplementare',
  'Valore statistico in euro',
  'Natura della transazione',
  'Modalita di trasporto',
  'Paese di destinazione',
  'Regime statistico',
];

const CSV_HEADER_INTRA_2BIS: ReadonlyArray<string> = [
  'Codice ISO Stato membro cedente',
  'Codice IVA cedente',
  'Ammontare delle operazioni in euro',
  'Codice nomenclatura combinata NC8',
  'Massa netta in kg',
  'Unita supplementare',
  'Valore statistico in euro',
  'Natura della transazione',
  'Modalita di trasporto',
  'Paese di provenienza',
  'Paese di origine delle merci',
  'Regime statistico',
];

function csvRowIntra1Bis(l: IntrastatLine): ReadonlyArray<string> {
  return [
    l.partnerCountry,
    l.partnerVatNumber ?? '',
    centsToEuroIntegerString(Number(l.valueCents)),
    l.nc8Code ?? '',
    l.netMassKg ?? '',
    l.supplementaryUnits ?? '',
    centsToEuroIntegerString(Number(l.statisticalValueCents ?? l.valueCents)),
    l.naturaTransazione ?? '',
    l.modalitaTrasporto ?? '',
    l.paeseDestinazioneProvenienza ?? '',
    l.regimeStatistico ?? '',
  ];
}

function csvRowIntra2Bis(l: IntrastatLine): ReadonlyArray<string> {
  return [
    l.partnerCountry,
    l.partnerVatNumber ?? '',
    centsToEuroIntegerString(Number(l.valueCents)),
    l.nc8Code ?? '',
    l.netMassKg ?? '',
    l.supplementaryUnits ?? '',
    centsToEuroIntegerString(Number(l.statisticalValueCents ?? l.valueCents)),
    l.naturaTransazione ?? '',
    l.modalitaTrasporto ?? '',
    l.paeseDestinazioneProvenienza ?? '',
    l.paeseOrigine ?? '',
    l.regimeStatistico ?? '',
  ];
}

function renderIntrastatXml(
  decl: IntrastatDeclaration & { lines: IntrastatLine[] },
): string {
  const period = decl.periodMonth
    ? `${decl.periodYear}-${String(decl.periodMonth).padStart(2, '0')}`
    : `${decl.periodYear}-Q${decl.periodQuarter ?? 0}`;
  const linesXml = decl.lines
    .map((l, i) => {
      const valueEuro = centsToEuroIntegerString(Number(l.valueCents));
      const statEuro = centsToEuroIntegerString(
        Number(l.statisticalValueCents ?? l.valueCents),
      );
      return [
        `    <Riga numero="${i + 1}">`,
        `      <PaesePartner>${escXml(l.partnerCountry)}</PaesePartner>`,
        `      <CodiceIvaPartner>${escXml(l.partnerVatNumber ?? '')}</CodiceIvaPartner>`,
        `      <AmmontareEuro>${valueEuro}</AmmontareEuro>`,
        `      <NC8>${escXml(l.nc8Code ?? '')}</NC8>`,
        `      <MassaNettaKg>${escXml(l.netMassKg ?? '')}</MassaNettaKg>`,
        `      <UnitaSupplementare>${escXml(l.supplementaryUnits ?? '')}</UnitaSupplementare>`,
        `      <ValoreStatisticoEuro>${statEuro}</ValoreStatisticoEuro>`,
        `      <NaturaTransazione>${escXml(l.naturaTransazione ?? '')}</NaturaTransazione>`,
        `      <ModalitaTrasporto>${escXml(l.modalitaTrasporto ?? '')}</ModalitaTrasporto>`,
        `      <PaeseDestinazioneOProvenienza>${escXml(l.paeseDestinazioneProvenienza ?? '')}</PaeseDestinazioneOProvenienza>`,
        `      <PaeseOrigine>${escXml(l.paeseOrigine ?? '')}</PaeseOrigine>`,
        `      <RegimeStatistico>${escXml(l.regimeStatistico ?? '')}</RegimeStatistico>`,
        '    </Riga>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<IntrastatDeclaration tipo="${decl.type}" periodo="${period}" totaleEuro="${centsToEuroIntegerString(Number(decl.totalValueCents))}" righe="${decl.lineCount}">`,
    '  <Righe>',
    linesXml,
    '  </Righe>',
    '</IntrastatDeclaration>',
    '',
  ].join('\n');
}

function centsToEuroIntegerString(cents: number): string {
  // ADM expects whole euro amounts, half-up rounding.
  return String(Math.round(cents / 100));
}

function startOfMonth(year: number, month: number): Date {
  // month here may be 13 (caller passes month+1); JS Date normalises that.
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatFilename(
  type: IntrastatDeclarationType,
  year: number,
  month: number | null,
  ext: 'csv' | 'xml',
): string {
  const code = type === 'cessioni' ? 'INTRA-1bis' : 'INTRA-2bis';
  const period = month
    ? `${year}-${String(month).padStart(2, '0')}`
    : `${year}`;
  return `${code}_${period}.${ext}`;
}
