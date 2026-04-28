import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * MarketplacePackage — third-party module advertised in the SmartERP
 * marketplace (plan §31.3 Sprint 37; ADR-045 deferred).
 *
 * v1 ships the catalogue surface; live module-loading + sandboxing
 * lands in Sprint 38 alongside the first marketplace partners.
 */
@Entity('marketplace_packages')
@Index(['vendor', 'slug'], { unique: true })
@Index(['status'])
export class MarketplacePackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  vendor: string;

  @Column({ length: 100 })
  slug: string;

  @Column({ length: 200 })
  displayName: string;

  @Column({ type: 'text' })
  descriptionMd: string;

  @Column({ length: 50 })
  version: string;

  @Column({ length: 50, default: 'active' })
  status: 'active' | 'paused' | 'deprecated';

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  scopes: string[];

  @Column({ type: 'bigint', nullable: true })
  monthlyPriceCents: number | null;

  @Column({ length: 100, nullable: true })
  contactEmail: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('marketplace_installations')
@Index(['tenantId', 'packageId'], { unique: true })
@Index(['tenantId', 'status'])
export class MarketplaceInstallation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'uuid' })
  packageId: string;

  @Column({ length: 50, default: 'active' })
  status: 'active' | 'paused' | 'cancelled';

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  config: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  installedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
