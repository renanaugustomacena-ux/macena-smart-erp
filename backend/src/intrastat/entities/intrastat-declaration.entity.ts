import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DataClassification } from '../../common/data-classification.decorator';

/**
 * IntrastatDeclaration (Modello INTRA-1bis / INTRA-2bis) — monthly summary
 * of intra-EU trade in goods, due to Agenzia delle Dogane e dei Monopoli
 * (ADM) by the 25th of the month following the reference period
 * (Provv. AE 88406/2017; Det. ADM 13799/RU/2018).
 *
 * `type = cessioni` produces INTRA-1bis (intra-EU sales / dispatches);
 * `type = acquisti` produces INTRA-2bis (intra-EU acquisitions / arrivals).
 *
 * State machine (R-D07; plan §31.1 Sprint 16 / S16.2):
 *   DRAFT      → GENERATED   (CSV/XML produced; lines frozen)
 *   GENERATED  → SUBMITTED   (file dispatched to ADM Intrastat Web)
 *   SUBMITTED  → ACCEPTED | REJECTED
 *   GENERATED  → DRAFT       (re-open while still pre-submission)
 *   ACCEPTED, REJECTED       — terminal.
 *
 * Aggregation source (S16.2 v1):
 *   - cessioni  → `invoices` joined to `customers` filtered on EU non-IT
 *                 country (Customer.country).
 *   - acquisti  → `supplier_invoices` filtered on rows that carry a
 *                 partner country/VAT enrichment.
 */
export type IntrastatDeclarationType = 'cessioni' | 'acquisti';

export type IntrastatDeclarationStatus =
  | 'draft'
  | 'generated'
  | 'submitted'
  | 'accepted'
  | 'rejected';

export type IntrastatPeriodicity = 'monthly' | 'quarterly';

@Entity('intrastat_declarations')
@Index(
  ['tenantId', 'type', 'periodYear', 'periodMonth'],
  {
    unique: true,
    where: '"periodMonth" IS NOT NULL',
  },
)
@Index(['tenantId', 'status', 'periodYear', 'periodMonth'])
export class IntrastatDeclaration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'enum', enum: ['cessioni', 'acquisti'] })
  type: IntrastatDeclarationType;

  @Column({
    type: 'enum',
    enum: ['monthly', 'quarterly'],
    default: 'monthly',
  })
  periodicity: IntrastatPeriodicity;

  @Column({ type: 'int' })
  periodYear: number;

  /** 1-12 for monthly; 1-4 for quarterly. */
  @Column({ type: 'int', nullable: true })
  periodMonth: number | null;

  @Column({ type: 'int', nullable: true })
  periodQuarter: number | null;

  @Column({
    type: 'enum',
    enum: ['draft', 'generated', 'submitted', 'accepted', 'rejected'],
    default: 'draft',
  })
  status: IntrastatDeclarationStatus;

  @Column({ type: 'bigint', default: 0 })
  totalValueCents: number;

  @Column({ type: 'int', default: 0 })
  lineCount: number;

  /** ADM "protocollo telematico" returned at submission. */
  @Column({ length: 50, nullable: true })
  @DataClassification('confidential')
  admProtocollo: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  generatedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  rejectionReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  generatedBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  submittedBy: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => IntrastatLine, (l) => l.declaration, {
    cascade: ['insert', 'update'],
  })
  lines: IntrastatLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('intrastat_lines')
@Index(['tenantId', 'declarationId'])
@Index(['tenantId', 'sourceDocType', 'sourceDocId'])
export class IntrastatLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'uuid' })
  declarationId: string;

  /** 1-based ordinal in the declaration. Persisted to keep CSV/XML output stable. */
  @Column({ type: 'int' })
  position: number;

  @Column({ length: 2 })
  partnerCountry: string;

  @Column({ length: 32, nullable: true })
  @DataClassification('confidential')
  partnerVatNumber: string | null;

  @Column({ length: 8, nullable: true })
  nc8Code: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  netMassKg: string | null;

  @Column({ type: 'numeric', precision: 14, scale: 4, nullable: true })
  supplementaryUnits: string | null;

  @Column({ type: 'bigint' })
  valueCents: number;

  @Column({ type: 'bigint', nullable: true })
  statisticalValueCents: number | null;

  @Column({ length: 3, default: 'EUR' })
  currency: string;

  /** Natura transazione — colonna A (1 char) + colonna B (1 char) per AE 88406/2017. */
  @Column({ length: 2, nullable: true })
  naturaTransazione: string | null;

  /** Modalità di trasporto — single digit 1..9 per AE 88406/2017. */
  @Column({ length: 1, nullable: true })
  modalitaTrasporto: string | null;

  /** Regime statistico — 2 digits per AE 88406/2017. */
  @Column({ length: 2, nullable: true })
  regimeStatistico: string | null;

  /** Country of destination (cessioni) or provenance (acquisti). */
  @Column({ length: 2, nullable: true })
  paeseDestinazioneProvenienza: string | null;

  /** Country of origin (acquisti only). */
  @Column({ length: 2, nullable: true })
  paeseOrigine: string | null;

  /** 'invoice' | 'supplier_invoice' — anchors the line back to its source. */
  @Column({
    type: 'enum',
    enum: ['invoice', 'supplier_invoice'],
  })
  sourceDocType: 'invoice' | 'supplier_invoice';

  @Column({ type: 'uuid' })
  sourceDocId: string;

  @ManyToOne(() => IntrastatDeclaration, (d) => d.lines, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'declarationId' })
  declaration: IntrastatDeclaration;
}

/**
 * Hard-coded EU member states (excluding IT). Used to filter intra-EU
 * counterparties when aggregating from invoices / supplier invoices.
 *
 * Source: Reg. UE 2024/1148 list (active 2026); UK excluded since 2021.
 */
export const EU_MEMBER_STATES_EXCL_IT: ReadonlyArray<string> = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
];

export function isIntraEuPartner(country: string | null | undefined): boolean {
  if (!country) return false;
  return EU_MEMBER_STATES_EXCL_IT.includes(country.toUpperCase());
}
