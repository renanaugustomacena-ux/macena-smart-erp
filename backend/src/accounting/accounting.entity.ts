import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';

/**
 * Italian GAAP account classification following the IV Direttiva CEE (4th
 * EU Accounting Directive) structure, implemented via the Piano dei Conti IV
 * Direttiva CEE seed template.
 */
export enum AccountType {
  ASSET = 'asset',                     // attività
  LIABILITY = 'liability',             // passività
  EQUITY = 'equity',                   // patrimonio netto
  REVENUE = 'revenue',                 // ricavi
  EXPENSE = 'expense',                 // costi
  COST_OF_GOODS_SOLD = 'cogs',         // costo del venduto
  OTHER = 'other',
}

/**
 * Italian invoice document types per FatturaPA v1.2.2 specification.
 * TD01 = Fattura, TD02 = Acconto/Anticipo su fattura, TD03 = Acconto/Anticipo
 * su parcella, TD04 = Nota di Credito, TD05 = Nota di Debito, TD06 = Parcella,
 * TD16-TD28 = reverse charge, integration, self-invoicing, cross-border.
 */
export enum InvoiceDocumentType {
  TD01 = 'TD01',   // Standard invoice
  TD02 = 'TD02',   // Advance on invoice
  TD04 = 'TD04',   // Credit note (nota di credito)
  TD05 = 'TD05',   // Debit note (nota di debito)
  TD17 = 'TD17',   // Cross-border purchase from foreign supplier
  TD18 = 'TD18',   // Intra-EU purchase of goods
  TD19 = 'TD19',   // Reverse charge, goods at customs warehouse
  TD24 = 'TD24',   // Deferred invoice art. 21 DPR 633/1972
  TD26 = 'TD26',   // Cessione di beni ammortizzabili
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  QUEUED = 'queued',
  SENT = 'sent',
  RECEIVED = 'received',        // SDI RC — Ricevuta Consegna
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',        // SDI NS — Notifica Scarto
  NOT_DELIVERED = 'not_delivered', // SDI MC — Mancata Consegna (retry via PEC)
  EXPIRED = 'expired',          // SDI DT — Decorrenza Termini
  CANCELLED = 'cancelled',
}

@Entity('chart_of_accounts')
@Index(['tenantId', 'code'], { unique: true })
export class ChartOfAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  /** Piano dei Conti code, e.g., '04.01.001' for Ricavi delle vendite. */
  @Column({ length: 20 })
  code: string;

  @Column({ length: 255 })
  description: string;

  @Column({ type: 'enum', enum: AccountType })
  type: AccountType;

  @Column({ length: 20, nullable: true })
  parentCode: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isBankAccount: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('journal_entries')
@Index(['tenantId', 'entryDate'])
@Index(['tenantId', 'reference'], { unique: false })
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  reference: string;

  @Column({ type: 'date' })
  entryDate: Date;

  @Column({ length: 50, nullable: true })
  journal: string;

  @Column({ length: 500 })
  description: string;

  /**
   * Lines store the double-entry records. Sum of debit must equal sum of
   * credit; enforced at service layer and, in production, via a DB constraint
   * trigger.
   */
  @Column({ type: 'jsonb' })
  lines: {
    accountId: string;
    accountCode: string;
    debit: number;
    credit: number;
    description?: string;
  }[];

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalDebit: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalCredit: number;

  @Column({ type: 'boolean', default: false })
  isPosted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('invoices')
@Index(['tenantId', 'number', 'fiscalYear'], { unique: true })
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'enum', enum: InvoiceDocumentType, default: InvoiceDocumentType.TD01 })
  documentType: InvoiceDocumentType;

  /** Progressivo annuale della fattura. Combined uniqueness with fiscalYear. */
  @Column({ length: 20 })
  number: string;

  @Column({ type: 'int' })
  fiscalYear: number;

  @Column({ type: 'date' })
  invoiceDate: Date;

  @Column()
  customerId: string;

  @Column({ length: 255 })
  customerName: string;

  @Column({ length: 11, nullable: true })
  customerVatNumber: string;

  @Column({ length: 16, nullable: true })
  customerFiscalCode: string;

  @Column({ length: 7, nullable: true })
  customerSdiCode: string;

  @Column({ length: 255, nullable: true })
  customerPecEmail: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotalAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  lines: {
    description: string;
    quantity: number;
    unitPrice: number;
    ivaRate: number;
    ivaNature?: string;  // N1–N7 for non-taxable operations
    lineTotal: number;
  }[];

  /** Path to generated FatturaPA XML in object storage. */
  @Column({ length: 500, nullable: true })
  xmlPath: string;

  /** Path to SDI receipt (Ricevuta). */
  @Column({ length: 500, nullable: true })
  receiptPath: string;

  /** Path to conservation-package archive (Conservazione a Norma). */
  @Column({ length: 500, nullable: true })
  archivePath: string;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  archivedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
