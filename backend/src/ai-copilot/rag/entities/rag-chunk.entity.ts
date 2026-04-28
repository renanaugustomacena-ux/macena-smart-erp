import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { DataClassification } from '../../../common/data-classification.decorator';

/**
 * RagChunk — per-tenant retrievable chunk of operational text
 * (plan §31.2 Sprint 26 / S26.1..S26.6).
 *
 * Sources covered v1:
 *   - audit log entries (S26.2)
 *   - customer master data (name + address + notes)
 *   - product master data (description + category)
 *
 * `embedding` is the pgvector column; v1 stores the canonical 1536-dim
 * vector using the `vector` extension (see migration M-025). When
 * pgvector is unavailable the column is null and retrieval falls back
 * to ILIKE substring search.
 *
 * Tenant-scoped retrieval is enforced at every callsite by an explicit
 * `tenantId =` predicate (R-D02). PII redaction (S26.5) runs before
 * embedding so no email/PEC/CF leaks into the vector store.
 */
@Entity('rag_chunks')
@Index(['tenantId', 'sourceType', 'sourceId'])
@Index(['tenantId', 'sourceType'])
export class RagChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({
    type: 'enum',
    enum: ['audit', 'customer', 'product', 'invoice', 'supplier_invoice'],
  })
  sourceType: 'audit' | 'customer' | 'product' | 'invoice' | 'supplier_invoice';

  @Column({ length: 200 })
  sourceId: string;

  /** PII-redacted chunk body (already passed through the redactor). */
  @Column({ type: 'text' })
  @DataClassification('confidential')
  body: string;

  /**
   * 1536-dim vector. Stored as a canonical float-array text column for
   * portability — when pgvector is enabled by the M-025 follow-up, the
   * column gets re-typed via ALTER TABLE in M-026.
   */
  @Column({ type: 'jsonb', nullable: true })
  embedding: number[] | null;

  /** Hash of the source row + content; used for incremental ingest. */
  @Column({ length: 64 })
  contentHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
