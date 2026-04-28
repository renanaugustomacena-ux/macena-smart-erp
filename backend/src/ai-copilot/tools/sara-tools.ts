import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CopilotTool } from '../tool-registry.service';
import { Invoice } from '../../accounting/accounting.entity';
import { SupplierInvoice } from '../../procurement/entities/supplier-invoice.entity';
import { Customer } from '../../sales/sales.entity';
import { IntrastatDeclaration } from '../../intrastat/entities/intrastat-declaration.entity';
import { ReadModelRow } from '../../bi/entities/read-model-row.entity';

const PERSONA = 'sara' as const;

/**
 * Sara cockpit Copilot tools (plan §31.2 Sprint 25 / S25.4).
 *
 * 10 tools targeting the admin/contabilità persona. All are tenant-
 * scoped + read-only in v1 (mutations are reserved for Sprint 27 once
 * the user-confirmation surface lands).
 */

@Injectable()
export class ListInvoicesTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'list_invoices',
    description: 'List recent invoices issued by the tenant.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', format: 'date' },
        to: { type: 'string', format: 'date' },
        limit: { type: 'integer', maximum: 100 },
      },
      additionalProperties: false,
    },
  };
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}
  async execute(tenantId: string, input: Record<string, unknown>) {
    const from = input.from ? new Date(input.from as string) : null;
    const to = input.to ? new Date(input.to as string) : null;
    const limit = (input.limit as number | undefined) ?? 25;
    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.tenantId = :tenantId', { tenantId });
    if (from) qb.andWhere('i.invoiceDate >= :from', { from });
    if (to) qb.andWhere('i.invoiceDate < :to', { to });
    return qb.orderBy('i.invoiceDate', 'DESC').limit(limit).getMany();
  }
}

@Injectable()
export class FindSupplierInvoiceTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'find_supplier_invoice',
    description: 'Find a supplier invoice by number or supplier id.',
    input_schema: {
      type: 'object',
      properties: {
        supplierInvoiceNumber: { type: 'string' },
        supplierId: { type: 'string' },
      },
      additionalProperties: false,
    },
  };
  constructor(
    @InjectRepository(SupplierInvoice)
    private readonly siRepo: Repository<SupplierInvoice>,
  ) {}
  async execute(tenantId: string, input: Record<string, unknown>) {
    const qb = this.siRepo
      .createQueryBuilder('si')
      .where('si.tenantId = :tenantId', { tenantId });
    if (input.supplierInvoiceNumber)
      qb.andWhere('si.supplierInvoiceNumber = :n', {
        n: input.supplierInvoiceNumber,
      });
    if (input.supplierId)
      qb.andWhere('si.supplierId = :s', { s: input.supplierId });
    return qb.orderBy('si.supplierInvoiceDate', 'DESC').limit(20).getMany();
  }
}

@Injectable()
export class SummariseIvaTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'summarise_iva',
    description: 'Summarise IVA balance for a fiscal period (YYYY-MM).',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
      },
      required: ['period'],
      additionalProperties: false,
    },
  };
  constructor(
    @InjectRepository(ReadModelRow)
    private readonly rmRepo: Repository<ReadModelRow>,
  ) {}
  async execute(tenantId: string, input: Record<string, unknown>) {
    const period = input.period as string;
    const row = await this.rmRepo.findOne({
      where: {
        tenantId,
        projectionId: 'iva_periodic_balance',
        key: period,
      },
    });
    return row ?? { period, payload: { ivaSalesCents: 0, ivaPurchasesCents: 0, balanceCents: 0 } };
  }
}

@Injectable()
export class ListCustomersTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'list_customers',
    description: 'List customers with optional substring filter.',
    input_schema: {
      type: 'object',
      properties: {
        contains: { type: 'string' },
        limit: { type: 'integer', maximum: 200 },
      },
      additionalProperties: false,
    },
  };
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}
  async execute(tenantId: string, input: Record<string, unknown>) {
    const limit = (input.limit as number | undefined) ?? 50;
    const qb = this.customerRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId });
    if (input.contains)
      qb.andWhere('LOWER(c.name) LIKE :q', {
        q: `%${(input.contains as string).toLowerCase()}%`,
      });
    return qb.orderBy('c.name', 'ASC').limit(limit).getMany();
  }
}

@Injectable()
export class TopCustomersTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'top_customers',
    description: 'Top-N customers by revenue YTD via the BI projection.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', maximum: 50 } },
      additionalProperties: false,
    },
  };
  constructor(
    @InjectRepository(ReadModelRow)
    private readonly rmRepo: Repository<ReadModelRow>,
  ) {}
  async execute(tenantId: string, input: Record<string, unknown>) {
    const limit = (input.limit as number | undefined) ?? 10;
    return this.rmRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.projectionId = :p', { p: 'customer_revenue_ranking' })
      .orderBy("(r.payload->>'totalCents')::bigint", 'DESC')
      .limit(limit)
      .getMany();
  }
}

@Injectable()
export class TopSuppliersTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'top_suppliers',
    description: 'Top-N suppliers by spend YTD via the BI projection.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', maximum: 50 } },
      additionalProperties: false,
    },
  };
  constructor(
    @InjectRepository(ReadModelRow)
    private readonly rmRepo: Repository<ReadModelRow>,
  ) {}
  async execute(tenantId: string, input: Record<string, unknown>) {
    const limit = (input.limit as number | undefined) ?? 10;
    return this.rmRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.projectionId = :p', { p: 'supplier_spend_ranking' })
      .orderBy("(r.payload->>'totalCents')::bigint", 'DESC')
      .limit(limit)
      .getMany();
  }
}

@Injectable()
export class IntrastatStatusTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'intrastat_status',
    description: 'Status of the latest INTRA-1bis + INTRA-2bis declarations.',
    input_schema: {
      type: 'object',
      properties: { year: { type: 'integer' } },
      additionalProperties: false,
    },
  };
  constructor(
    @InjectRepository(IntrastatDeclaration)
    private readonly intrastatRepo: Repository<IntrastatDeclaration>,
  ) {}
  async execute(tenantId: string, input: Record<string, unknown>) {
    const qb = this.intrastatRepo
      .createQueryBuilder('d')
      .where('d.tenantId = :tenantId', { tenantId });
    if (input.year)
      qb.andWhere('d.periodYear = :y', { y: input.year });
    return qb
      .orderBy('d.periodYear', 'DESC')
      .addOrderBy('d.periodMonth', 'DESC')
      .limit(24)
      .getMany();
  }
}

@Injectable()
export class MonthlySalesTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'monthly_sales',
    description: 'Monthly invoice totals via the BI projection.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
        to: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
      },
      additionalProperties: false,
    },
  };
  constructor(
    @InjectRepository(ReadModelRow)
    private readonly rmRepo: Repository<ReadModelRow>,
  ) {}
  async execute(tenantId: string, input: Record<string, unknown>) {
    const qb = this.rmRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.projectionId = :p', { p: 'monthly_invoice_totals' });
    if (input.from) qb.andWhere('r.key >= :f', { f: input.from });
    if (input.to) qb.andWhere('r.key < :t', { t: input.to });
    return qb.orderBy('r.key', 'ASC').limit(36).getMany();
  }
}

@Injectable()
export class MonthlyPurchasesTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'monthly_purchases',
    description: 'Monthly supplier-invoice totals via the BI projection.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
        to: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
      },
      additionalProperties: false,
    },
  };
  constructor(
    @InjectRepository(ReadModelRow)
    private readonly rmRepo: Repository<ReadModelRow>,
  ) {}
  async execute(tenantId: string, input: Record<string, unknown>) {
    const qb = this.rmRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('r.projectionId = :p', { p: 'monthly_supplier_invoice_totals' });
    if (input.from) qb.andWhere('r.key >= :f', { f: input.from });
    if (input.to) qb.andWhere('r.key < :t', { t: input.to });
    return qb.orderBy('r.key', 'ASC').limit(36).getMany();
  }
}

@Injectable()
export class CashSnapshotTool implements CopilotTool {
  readonly persona = PERSONA;
  readonly definition = {
    name: 'cash_snapshot',
    description:
      'Snapshot of the tenant bank-transaction reconciliation status counters.',
    input_schema: { type: 'object', additionalProperties: false },
  };
  // Treasury-side count is computed via the BI projection layer once
  // S28 ships a treasury-balance projection. v1 returns a stable shape
  // with zero counters so the contract is testable.
  async execute(_tenantId: string) {
    return {
      reconciled: 0,
      unmatched: 0,
      ignored: 0,
      lastSyncedAt: null,
    };
  }
}

export const SARA_TOOL_PROVIDERS = [
  ListInvoicesTool,
  FindSupplierInvoiceTool,
  SummariseIvaTool,
  ListCustomersTool,
  TopCustomersTool,
  TopSuppliersTool,
  IntrastatStatusTool,
  MonthlySalesTool,
  MonthlyPurchasesTool,
  CashSnapshotTool,
];
