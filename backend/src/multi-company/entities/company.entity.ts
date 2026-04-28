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
 * Company — sub-entity of a Tenant for multi-company / multi-entity
 * deployments (plan §31.2 Sprint 33; ADR-039 deferred).
 *
 * Italian "famiglia di società" / holding structures common in Veneto
 * map onto a single Tenant with N Company rows. Per-Company fiscal
 * fields (P.IVA / CF / address) are independent — every fiscally
 * distinct legal entity gets its own Company row.
 *
 * Document-level entities (invoices, supplier_invoices, ddts, …) gain
 * an optional `companyId` column from M-027 (deferred); when null,
 * the document inherits from the tenant's primary company.
 */
@Entity('companies')
@Index(['tenantId', 'code'], { unique: true })
@Index(['tenantId', 'vatNumber'], {
  unique: true,
  where: '"vatNumber" IS NOT NULL',
})
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  @DataClassification('confidential')
  code: string;

  @Column({ length: 200 })
  @DataClassification('confidential')
  name: string;

  @Column({ length: 11, nullable: true })
  @DataClassification('confidential')
  vatNumber: string | null;

  @Column({ length: 16, nullable: true })
  @DataClassification('confidential')
  fiscalCode: string | null;

  @Column({ length: 7, nullable: true })
  @DataClassification('confidential')
  sdiDestinationCode: string | null;

  @Column({ length: 255, nullable: true })
  @DataClassification('confidential')
  pecEmail: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  @DataClassification('confidential')
  address: Record<string, unknown>;

  @Column({ length: 3, default: 'EUR' })
  currency: string;

  /**
   * Marks the Company as the tenant's "primary" — used to backfill the
   * companyId on rows that don't carry one. Exactly one Company per
   * tenant should have isPrimary = true; the migration enforces this.
   */
  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
