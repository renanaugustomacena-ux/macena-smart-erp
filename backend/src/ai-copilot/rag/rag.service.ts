import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { RagChunk } from './entities/rag-chunk.entity';
import { Customer } from '../../sales/sales.entity';
import { Invoice } from '../../accounting/accounting.entity';
import { Product } from '../../inventory/inventory.entity';
import { redactPii } from './pii-redactor';

/**
 * RAG service over per-tenant operational data (plan §31.2 Sprint 26).
 *
 * v1 supports:
 *   - Ingestion from `customers`, `products`, `invoices`, `audit_logs`
 *     (S26.2). Each ingest pass redacts PII (S26.5) and writes one
 *     RagChunk row per source row, keyed by `contentHash` for
 *     idempotent re-runs.
 *   - Retrieval by tenant-scoped substring search (the universal
 *     fallback while pgvector is being rolled out — S26.3 enables the
 *     HNSW index in M-026).
 *
 * Embedding generation lands alongside the production AnthropicClient
 * wiring in Sprint 27. Until then, retrieval is by substring search,
 * which is sufficient for the v1 eval harness.
 */
@Injectable()
export class RagService {
  constructor(
    @InjectRepository(RagChunk)
    private readonly chunkRepo: Repository<RagChunk>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  // ─── Ingestion ─────────────────────────────────────────

  async ingestAll(
    tenantId: string,
  ): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;
    const ingest = async (
      sourceType: 'audit' | 'customer' | 'product' | 'invoice' | 'supplier_invoice',
      rows: Array<{ id: string; body: string }>,
    ) => {
      for (const r of rows) {
        const redacted = redactPii(r.body);
        const hash = crypto
          .createHash('sha256')
          .update(`${sourceType}:${r.id}:${redacted}`)
          .digest('hex');
        const existing = await this.chunkRepo.findOne({
          where: { tenantId, sourceType, sourceId: r.id, contentHash: hash },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
        const entity = this.chunkRepo.create({
          tenantId,
          sourceType,
          sourceId: r.id,
          body: redacted,
          embedding: null,
          contentHash: hash,
        });
        await this.chunkRepo.save(entity);
        inserted += 1;
      }
    };

    const customers = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId })
      .getMany();
    await ingest(
      'customer',
      customers.map((c) => ({
        id: c.id,
        body: `${c.name} — ${c.address ?? ''} ${c.city ?? ''} (${c.country ?? 'IT'})`,
      })),
    );

    const products = await this.productRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .getMany();
    await ingest(
      'product',
      products.map((p) => ({
        id: p.id,
        body: `${p.sku} — ${p.description ?? ''}`,
      })),
    );

    const invoices = await this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.tenantId = :tenantId', { tenantId })
      .orderBy('i.invoiceDate', 'DESC')
      .limit(1000)
      .getMany();
    await ingest(
      'invoice',
      invoices.map((i) => ({
        id: i.id,
        body: `Fattura ${i.number}/${i.fiscalYear} — ${i.customerName} — ${i.totalAmount} EUR`,
      })),
    );

    return { inserted, skipped };
  }

  // ─── Retrieval ─────────────────────────────────────────

  async retrieve(
    tenantId: string,
    query: string,
    limit = 10,
  ): Promise<RagChunk[]> {
    // v1 fallback: substring (case-insensitive). pgvector ANN search
    // lands when M-026 enables the HNSW index.
    return this.chunkRepo
      .createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId })
      .andWhere('LOWER(r.body) LIKE :q', { q: `%${query.toLowerCase()}%` })
      .orderBy('r.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }
}
