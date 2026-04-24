import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere, DataSource } from 'typeorm';
import {
  ChartOfAccount,
  AccountType,
  JournalEntry,
  Invoice,
  InvoiceDocumentType,
  InvoiceStatus,
} from './accounting.entity';
import { FatturaPaAdapter } from './fatturapa/fatturapa-adapter';
import { Customer, SalesOrder } from '../sales/sales.entity';
import { Tenant } from '../tenants/tenant.entity';
import { MetricsService } from '../metrics/metrics.service';

export interface CreateAccountInput {
  code: string;
  description: string;
  type: AccountType;
  parentCode?: string;
  isBankAccount?: boolean;
}

export interface JournalLineInput {
  accountId?: string;
  accountCode: string;
  debit?: number;
  credit?: number;
  description?: string;
}

export interface CreateJournalEntryInput {
  reference: string;
  entryDate: string;
  journal?: string;
  description: string;
  lines: JournalLineInput[];
  autoPost?: boolean;
}

export interface CreateInvoiceInput {
  documentType?: InvoiceDocumentType;
  invoiceDate: string;
  customerId: string;
  customerName: string;
  customerVatNumber?: string;
  customerFiscalCode?: string;
  customerSdiCode?: string;
  customerPecEmail?: string;
  salesOrderId?: string;
  lines: {
    description: string;
    quantity: number;
    unitPrice: number;
    ivaRate: number;
    ivaNature?: string;
  }[];
  notes?: string;
}

/**
 * Piano dei Conti — special account codes used by auto-posting logic.
 * The mapping targets the IV Direttiva CEE template seeded by
 * `seedChartOfAccounts`.
 */
const ACC = {
  CREDITI_CLIENTI: '01.04',
  IVA_DEBITO: '02.02.001',
  RICAVI_VENDITA: '04.01.001',
} as const;

@Injectable()
export class AccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    @InjectRepository(ChartOfAccount)
    private readonly accountRepo: Repository<ChartOfAccount>,
    @InjectRepository(JournalEntry)
    private readonly journalRepo: Repository<JournalEntry>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(SalesOrder)
    private readonly salesOrderRepo: Repository<SalesOrder>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly fatturaPa: FatturaPaAdapter,
    private readonly dataSource: DataSource,
    private readonly metrics: MetricsService,
  ) {}

  // ─── Chart of Accounts ─────────────────────────────────────────

  async createAccount(
    tenantId: string,
    dto: CreateAccountInput,
  ): Promise<ChartOfAccount> {
    const existing = await this.accountRepo.findOne({
      where: { tenantId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(
        `Account code ${dto.code} already exists for this tenant`,
      );
    }
    const account = this.accountRepo.create({ ...dto, tenantId });
    return this.accountRepo.save(account);
  }

  async listAccounts(
    tenantId: string,
    type?: AccountType,
  ): Promise<ChartOfAccount[]> {
    const where: FindOptionsWhere<ChartOfAccount> = { tenantId, isActive: true };
    if (type) where.type = type;
    return this.accountRepo.find({ where, order: { code: 'ASC' } });
  }

  async getAccountByCode(
    tenantId: string,
    code: string,
  ): Promise<ChartOfAccount | null> {
    return this.accountRepo.findOne({ where: { tenantId, code } });
  }

  /**
   * Seed the Piano dei Conti IV Direttiva CEE template for a tenant.
   *
   * Mapping to Codice Civile art. 2424 (IV Direttiva CEE — "Stato
   * Patrimoniale") — see `docs/ITALIAN-COMPLIANCE.md` for the full crosswalk.
   * Idempotent.
   */
  async seedChartOfAccounts(tenantId: string): Promise<number> {
    const template: Array<CreateAccountInput> = [
      { code: '01', description: 'ATTIVITÀ', type: AccountType.ASSET },
      { code: '01.01', description: 'Immobilizzazioni immateriali (B.I art. 2424)', type: AccountType.ASSET, parentCode: '01' },
      { code: '01.02', description: 'Immobilizzazioni materiali (B.II art. 2424)', type: AccountType.ASSET, parentCode: '01' },
      { code: '01.03', description: 'Rimanenze (C.I art. 2424)', type: AccountType.ASSET, parentCode: '01' },
      { code: '01.04', description: 'Crediti verso clienti (C.II.1 art. 2424)', type: AccountType.ASSET, parentCode: '01' },
      { code: '01.05', description: 'Disponibilità liquide (C.IV art. 2424)', type: AccountType.ASSET, parentCode: '01' },
      { code: '01.05.001', description: 'Banca c/c', type: AccountType.ASSET, parentCode: '01.05', isBankAccount: true },
      { code: '01.05.002', description: 'Cassa contante', type: AccountType.ASSET, parentCode: '01.05' },
      { code: '02', description: 'PASSIVITÀ', type: AccountType.LIABILITY },
      { code: '02.01', description: 'Debiti verso fornitori (D.7 art. 2424)', type: AccountType.LIABILITY, parentCode: '02' },
      { code: '02.02', description: 'Debiti tributari (D.12 art. 2424)', type: AccountType.LIABILITY, parentCode: '02' },
      { code: '02.02.001', description: 'IVA a debito', type: AccountType.LIABILITY, parentCode: '02.02' },
      { code: '02.03', description: 'Debiti verso istituti di previdenza (D.13 art. 2424)', type: AccountType.LIABILITY, parentCode: '02' },
      { code: '03', description: 'PATRIMONIO NETTO (A art. 2424)', type: AccountType.EQUITY },
      { code: '03.01', description: 'Capitale sociale (A.I art. 2424)', type: AccountType.EQUITY, parentCode: '03' },
      { code: '03.02', description: 'Riserve (A.IV-VIII art. 2424)', type: AccountType.EQUITY, parentCode: '03' },
      { code: '04', description: 'RICAVI (A art. 2425)', type: AccountType.REVENUE },
      { code: '04.01', description: 'Ricavi delle vendite e delle prestazioni (A.1 art. 2425)', type: AccountType.REVENUE, parentCode: '04' },
      { code: '04.01.001', description: 'Ricavi vendita prodotti', type: AccountType.REVENUE, parentCode: '04.01' },
      { code: '04.01.002', description: 'Ricavi prestazioni servizi', type: AccountType.REVENUE, parentCode: '04.01' },
      { code: '05', description: 'COSTI (B art. 2425)', type: AccountType.EXPENSE },
      { code: '05.01', description: 'Costi per materie prime (B.6 art. 2425)', type: AccountType.COST_OF_GOODS_SOLD, parentCode: '05' },
      { code: '05.02', description: 'Costi per servizi (B.7 art. 2425)', type: AccountType.EXPENSE, parentCode: '05' },
      { code: '05.03', description: 'Costi per il personale (B.9 art. 2425)', type: AccountType.EXPENSE, parentCode: '05' },
      { code: '05.04', description: 'Ammortamenti (B.10 art. 2425)', type: AccountType.EXPENSE, parentCode: '05' },
      { code: '05.05', description: 'Oneri finanziari (C.17 art. 2425)', type: AccountType.EXPENSE, parentCode: '05' },
    ];

    let created = 0;
    for (const account of template) {
      const existing = await this.accountRepo.findOne({
        where: { tenantId, code: account.code },
      });
      if (!existing) {
        await this.accountRepo.save(
          this.accountRepo.create({ ...account, tenantId }),
        );
        created++;
      }
    }
    this.logger.log(
      `Seeded ${created} chart-of-accounts entries for tenant ${tenantId}`,
    );
    return created;
  }

  // ─── Journal Entries (Prima Nota) ──────────────────────────────

  async createJournalEntry(
    tenantId: string,
    dto: CreateJournalEntryInput,
  ): Promise<JournalEntry> {
    const lines = dto.lines.map((l) => ({
      accountId: l.accountId ?? '',
      accountCode: l.accountCode,
      debit: Number(l.debit ?? 0),
      credit: Number(l.credit ?? 0),
      description: l.description,
    }));
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new BadRequestException(
        `Journal entry unbalanced: debit ${totalDebit.toFixed(2)} != credit ${totalCredit.toFixed(2)}`,
      );
    }
    const entry = this.journalRepo.create({
      tenantId,
      reference: dto.reference,
      entryDate: new Date(dto.entryDate),
      journal: dto.journal ?? 'generale',
      description: dto.description,
      lines,
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
      isPosted: !!dto.autoPost,
    });
    return this.journalRepo.save(entry);
  }

  async listJournalEntries(
    tenantId: string,
    filter: { from?: string; to?: string; page?: number; limit?: number } = {},
  ) {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 20, 100);
    const where: FindOptionsWhere<JournalEntry> = { tenantId };
    if (filter.from && filter.to) {
      where.entryDate = Between(new Date(filter.from), new Date(filter.to));
    }
    const [data, total] = await this.journalRepo.findAndCount({
      where,
      order: { entryDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Invoices (FatturaPA) ──────────────────────────────────────

  async createInvoice(
    tenantId: string,
    dto: CreateInvoiceInput,
  ): Promise<Invoice> {
    const fiscalYear = new Date(dto.invoiceDate).getFullYear();
    const count = await this.invoiceRepo.count({
      where: { tenantId, fiscalYear },
    });
    const number = String(count + 1).padStart(6, '0');

    let subtotal = 0;
    let tax = 0;
    const lines = dto.lines.map((l) => {
      const lineTotal = Number((l.quantity * l.unitPrice).toFixed(2));
      subtotal += lineTotal;
      if (!l.ivaNature) {
        tax += Number(((lineTotal * l.ivaRate) / 100).toFixed(2));
      }
      return { ...l, lineTotal };
    });

    const invoice = this.invoiceRepo.create({
      tenantId,
      documentType: dto.documentType ?? InvoiceDocumentType.TD01,
      number,
      fiscalYear,
      invoiceDate: new Date(dto.invoiceDate),
      customerId: dto.customerId,
      customerName: dto.customerName,
      customerVatNumber: dto.customerVatNumber,
      customerFiscalCode: dto.customerFiscalCode,
      customerSdiCode: dto.customerSdiCode,
      customerPecEmail: dto.customerPecEmail,
      status: InvoiceStatus.DRAFT,
      subtotalAmount: Number(subtotal.toFixed(2)),
      taxAmount: Number(tax.toFixed(2)),
      totalAmount: Number((subtotal + tax).toFixed(2)),
      lines,
      notes: dto.notes,
    });

    const saved = await this.invoiceRepo.save(invoice);
    this.metrics.increment('smarterp_invoices_total', {
      documentType: saved.documentType,
    });
    this.logger.log(
      `Invoice created: ${saved.documentType} ${saved.number}/${saved.fiscalYear} total=${saved.totalAmount}`,
    );
    return saved;
  }

  async getInvoice(tenantId: string, id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { id, tenantId } });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    return invoice;
  }

  /**
   * Produce FatturaPA v1.2.2 XML for a given invoice.
   * Pure build — does not mutate invoice state.
   */
  async generateFatturaPaXml(tenantId: string, invoiceId: string): Promise<{
    xml: string;
    fileName: string;
  }> {
    const invoice = await this.getInvoice(tenantId, invoiceId);
    const customer = await this.customerRepo.findOne({
      where: { id: invoice.customerId, tenantId },
    });
    if (!customer) {
      throw new NotFoundException(
        `Invoice customer ${invoice.customerId} not found for tenant`,
      );
    }
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }
    if (!tenant.vatNumber) {
      throw new BadRequestException(
        'Tenant Partita IVA is not set — cannot produce FatturaPA. Update the tenant profile first.',
      );
    }
    const salesOrder = customer.id
      ? await this.salesOrderRepo.findOne({
          where: { tenantId, customerId: customer.id },
          order: { createdAt: 'DESC' },
        })
      : null;
    const { xml, fileName } = this.fatturaPa.build({
      tenant,
      customer,
      invoice,
      salesOrder: salesOrder ?? undefined,
    });
    return { xml, fileName };
  }

  /**
   * Transition invoice to ACCEPTED and post the corresponding double-entry
   * journal: `Crediti v/Clienti` DR vs. `Ricavi vendita` + `IVA a debito` CR.
   *
   * For split-payment invoices (art. 17-ter DPR 633/1972) the IVA is not
   * credited against `IVA a debito` because the VAT is paid directly by the
   * PA buyer; the receivable then equals the taxable base only.
   */
  async acceptInvoice(tenantId: string, id: string): Promise<Invoice> {
    return this.dataSource.transaction(async (manager) => {
      const invoiceRepo = manager.getRepository(Invoice);
      const customerRepo = manager.getRepository(Customer);
      const journalRepo = manager.getRepository(JournalEntry);
      const invoice = await invoiceRepo.findOne({ where: { id, tenantId } });
      if (!invoice) {
        throw new NotFoundException(`Invoice ${id} not found`);
      }
      if (invoice.status === InvoiceStatus.ACCEPTED) return invoice;
      const customer = await customerRepo.findOne({
        where: { id: invoice.customerId, tenantId },
      });
      const splitPayment = customer?.splitPayment === true;
      const taxable = Number(invoice.subtotalAmount);
      const iva = Number(invoice.taxAmount);
      const total = Number(invoice.totalAmount);
      const receivable = splitPayment ? taxable : total;

      const lines: JournalLineInput[] = [
        {
          accountCode: ACC.CREDITI_CLIENTI,
          debit: Number(receivable.toFixed(2)),
          credit: 0,
          description: `Fattura ${invoice.number}/${invoice.fiscalYear} verso ${invoice.customerName}`,
        },
        {
          accountCode: ACC.RICAVI_VENDITA,
          debit: 0,
          credit: Number(taxable.toFixed(2)),
          description: `Ricavi fattura ${invoice.number}/${invoice.fiscalYear}`,
        },
      ];
      if (!splitPayment && iva > 0) {
        lines.push({
          accountCode: ACC.IVA_DEBITO,
          debit: 0,
          credit: Number(iva.toFixed(2)),
          description: `IVA fattura ${invoice.number}/${invoice.fiscalYear}`,
        });
      }

      const totalDebit = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.001) {
        throw new BadRequestException(
          `Auto-generated journal unbalanced: debit ${totalDebit.toFixed(2)} vs credit ${totalCredit.toFixed(2)}`,
        );
      }
      await journalRepo.save(
        journalRepo.create({
          tenantId,
          reference: `INV-${invoice.number}-${invoice.fiscalYear}`,
          entryDate: new Date(),
          journal: 'vendite',
          description: `Registrazione fattura ${invoice.number}/${invoice.fiscalYear}`,
          lines: lines.map((l) => ({
            accountId: l.accountId ?? '',
            accountCode: l.accountCode,
            debit: Number(l.debit ?? 0),
            credit: Number(l.credit ?? 0),
            description: l.description,
          })),
          totalDebit: Number(totalDebit.toFixed(2)),
          totalCredit: Number(totalCredit.toFixed(2)),
          isPosted: true,
        }),
      );
      invoice.status = InvoiceStatus.ACCEPTED;
      return invoiceRepo.save(invoice);
    });
  }

  async queueInvoiceForSdi(tenantId: string, id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { id, tenantId } });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT invoices can be queued for SDI; current status: ${invoice.status}`,
      );
    }
    invoice.status = InvoiceStatus.QUEUED;
    invoice.submittedAt = new Date();
    this.logger.log(
      `Invoice ${invoice.number}/${invoice.fiscalYear} queued for SDI`,
    );
    return this.invoiceRepo.save(invoice);
  }

  async listInvoices(
    tenantId: string,
    filter: {
      status?: InvoiceStatus;
      fiscalYear?: number;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 20, 100);
    const where: FindOptionsWhere<Invoice> = { tenantId };
    if (filter.status) where.status = filter.status;
    if (filter.fiscalYear) where.fiscalYear = filter.fiscalYear;
    const [data, total] = await this.invoiceRepo.findAndCount({
      where,
      order: { invoiceDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Monthly/quarterly IVA liquidation.
   * Period format: 'YYYY-MM' for monthly, 'YYYY-Q1' for quarterly.
   * Aligned with DPR 633/1972 liquidazione periodica.
   */
  async ivaLiquidation(
    tenantId: string,
    period: string,
  ): Promise<{
    period: string;
    totalTaxable: number;
    totalIva: number;
    byRate: Record<string, { taxable: number; iva: number }>;
  }> {
    let from: Date;
    let to: Date;
    if (/^\d{4}-Q[1-4]$/.test(period)) {
      const [year, qPart] = period.split('-');
      const q = parseInt(qPart.substring(1));
      from = new Date(Number(year), (q - 1) * 3, 1);
      to = new Date(Number(year), q * 3, 0, 23, 59, 59);
    } else if (/^\d{4}-\d{2}$/.test(period)) {
      const [y, m] = period.split('-').map(Number);
      from = new Date(y, m - 1, 1);
      to = new Date(y, m, 0, 23, 59, 59);
    } else {
      throw new BadRequestException(`Invalid period format: ${period}`);
    }
    const invoices = await this.invoiceRepo.find({
      where: {
        tenantId,
        invoiceDate: Between(from, to),
        status: InvoiceStatus.ACCEPTED,
      },
    });
    let totalTaxable = 0;
    let totalIva = 0;
    const byRate: Record<string, { taxable: number; iva: number }> = {};
    for (const inv of invoices) {
      for (const line of inv.lines) {
        if (line.ivaNature) continue;
        const rateKey = `${line.ivaRate}%`;
        if (!byRate[rateKey]) byRate[rateKey] = { taxable: 0, iva: 0 };
        byRate[rateKey].taxable += line.lineTotal;
        byRate[rateKey].iva += (line.lineTotal * line.ivaRate) / 100;
        totalTaxable += line.lineTotal;
        totalIva += (line.lineTotal * line.ivaRate) / 100;
      }
    }
    return {
      period,
      totalTaxable: Number(totalTaxable.toFixed(2)),
      totalIva: Number(totalIva.toFixed(2)),
      byRate,
    };
  }
}
