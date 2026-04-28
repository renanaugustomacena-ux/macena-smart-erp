import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DataClassification } from '../../common/data-classification.decorator';

/**
 * BankAccount — per-tenant bank account record
 * (plan §31.1 Sprint 23 / S23.1).
 *
 * `ibanEncrypted` carries ciphertext per ADR-DA07; the plaintext is
 * never written to the column. The convenience method `getMaskedIban`
 * (in TreasuryService) returns `IT60****0123` for UI display.
 *
 * `psd2Provider` + `psd2Consent` capture the per-tenant PSD2 (XS2A)
 * consent needed to pull transactions automatically. v1 ships the
 * Intesa Sanpaolo adapter; further banks land in Sprint 31.
 */
export type BankAccountStatus = 'active' | 'inactive' | 'closed';
export type Psd2Provider = 'intesa' | 'unicredit' | 'bper' | 'manual';

@Entity('bank_accounts')
@Index(['tenantId', 'name'], { unique: true })
@Index(['tenantId', 'status'])
export class BankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 200 })
  name: string;

  /** Encrypted IBAN ciphertext (ADR-DA07). Plaintext never persisted. */
  @Column({ length: 500 })
  @DataClassification('restricted')
  ibanEncrypted: string;

  /** First 4 + last 4 chars of the plaintext IBAN, for UI display only. */
  @Column({ length: 12, nullable: true })
  @DataClassification('confidential')
  ibanMasked: string | null;

  @Column({ length: 11, nullable: true })
  @DataClassification('confidential')
  bicSwift: string | null;

  @Column({ length: 100, nullable: true })
  @DataClassification('confidential')
  bankName: string | null;

  @Column({ length: 3, default: 'EUR' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ['intesa', 'unicredit', 'bper', 'manual'],
    default: 'manual',
  })
  psd2Provider: Psd2Provider;

  @Column({ type: 'jsonb', nullable: true })
  @DataClassification('restricted')
  psd2Consent: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'closed'],
    default: 'active',
  })
  status: BankAccountStatus;

  /** Last cursor returned by the PSD2 provider's transaction-pull API. */
  @Column({ length: 200, nullable: true })
  lastTransactionCursor: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('bank_transactions')
@Index(['tenantId', 'bankAccountId', 'valueDate'])
@Index(['tenantId', 'reconciliationStatus'])
@Index(['tenantId', 'externalId'], { unique: true })
export class BankTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'uuid' })
  bankAccountId: string;

  /** External (PSD2 provider) unique id. Used for de-duplication. */
  @Column({ length: 200 })
  @DataClassification('confidential')
  externalId: string;

  /** Effective date the bank applied the entry. */
  @Column({ type: 'date' })
  valueDate: Date;

  /** Booking date (when the bank booked it). */
  @Column({ type: 'date' })
  bookingDate: Date;

  /** Positive = credit (incoming); negative = debit (outgoing). Cents (R-D04). */
  @Column({ type: 'bigint' })
  amountCents: number;

  @Column({ length: 3, default: 'EUR' })
  currency: string;

  @Column({ length: 500 })
  @DataClassification('confidential')
  description: string;

  /** Counterparty name (when the bank surfaces it). */
  @Column({ length: 200, nullable: true })
  @DataClassification('confidential')
  counterpartyName: string | null;

  @Column({ length: 500, nullable: true })
  @DataClassification('restricted')
  counterpartyIbanEncrypted: string | null;

  @Column({
    type: 'enum',
    enum: ['unmatched', 'matched', 'partial', 'ignored'],
    default: 'unmatched',
  })
  reconciliationStatus: 'unmatched' | 'matched' | 'partial' | 'ignored';

  /** Optional FK to the matched invoice / supplier_invoice. */
  @Column({ length: 50, nullable: true })
  matchedDocumentType: string | null;

  @Column({ type: 'uuid', nullable: true })
  matchedDocumentId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  matchedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  matchedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
