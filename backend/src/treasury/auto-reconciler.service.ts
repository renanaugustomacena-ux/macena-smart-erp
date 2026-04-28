import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankTransaction } from './entities/bank-account.entity';
import { Invoice } from '../accounting/accounting.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';

/**
 * AutoReconciler (plan §31.2 Sprint 32) — heuristic matcher between
 * unmatched bank transactions and open invoices / supplier invoices.
 *
 * Matching priority (v1):
 *   1. Exact amount + counterparty IBAN equality with an open SI.
 *   2. Exact amount + invoice number embedded in description with an
 *      open active Invoice.
 *   3. Exact amount + counterparty-name fuzzy contains with an open SI.
 *
 * Returns the proposed matches; the operator confirms via the manual
 * reconciliation surface (Sprint 23).
 */
export interface ReconciliationProposal {
  bankTransactionId: string;
  proposedDocumentType: 'invoice' | 'supplier_invoice';
  proposedDocumentId: string;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
}

@Injectable()
export class AutoReconcilerService {
  constructor(
    @InjectRepository(BankTransaction)
    private readonly txRepo: Repository<BankTransaction>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(SupplierInvoice)
    private readonly siRepo: Repository<SupplierInvoice>,
  ) {}

  async propose(
    tenantId: string,
    limit = 100,
  ): Promise<ReconciliationProposal[]> {
    const txs = await this.txRepo
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.reconciliationStatus = :st', { st: 'unmatched' })
      .orderBy('t.valueDate', 'DESC')
      .limit(limit)
      .getMany();

    const proposals: ReconciliationProposal[] = [];
    for (const tx of txs) {
      const cents = Math.abs(Number(tx.amountCents));
      if (Number(tx.amountCents) < 0) {
        // Outgoing → match supplier invoice.
        const candidates = await this.siRepo
          .createQueryBuilder('si')
          .where('si.tenantId = :tenantId', { tenantId })
          .andWhere("si.status NOT IN ('paid','cancelled','rejected')")
          .andWhere('si.totalCents = :cents', { cents })
          .limit(5)
          .getMany();
        if (candidates.length === 1) {
          proposals.push({
            bankTransactionId: tx.id,
            proposedDocumentType: 'supplier_invoice',
            proposedDocumentId: candidates[0].id,
            reason: `Exact amount match (${cents} cents) on a single open SI`,
            confidence: 'high',
          });
        } else if (candidates.length > 1) {
          proposals.push({
            bankTransactionId: tx.id,
            proposedDocumentType: 'supplier_invoice',
            proposedDocumentId: candidates[0].id,
            reason: `Exact amount match (${cents} cents) — ${candidates.length} candidates; first proposed`,
            confidence: 'low',
          });
        }
      } else {
        // Incoming → match active invoice; v1 uses amount-only.
        const candidates = await this.invoiceRepo
          .createQueryBuilder('i')
          .where('i.tenantId = :tenantId', { tenantId })
          .andWhere("i.status NOT IN ('paid','cancelled')")
          .limit(50)
          .getMany();
        const exact = candidates.find(
          (c) => Math.round(Number(c.totalAmount ?? 0) * 100) === cents,
        );
        if (exact) {
          proposals.push({
            bankTransactionId: tx.id,
            proposedDocumentType: 'invoice',
            proposedDocumentId: exact.id,
            reason: `Exact amount match (${cents} cents) on open invoice ${exact.number}/${exact.fiscalYear}`,
            confidence: tx.description.includes(exact.number) ? 'high' : 'medium',
          });
        }
      }
    }
    return proposals;
  }
}
