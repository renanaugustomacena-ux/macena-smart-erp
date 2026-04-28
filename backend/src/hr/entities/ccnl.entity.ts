import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * CCNL reference data (plan §31.1 Sprint 17 / S17.4).
 *
 * **Global**, NOT tenant-scoped: a CCNL applies across all Italian
 * employers in the sector. The `tenantId` predicate that R-D01 + R-D02
 * usually require does not apply here; per-call exemptions in the HR
 * service annotate why.
 *
 * v1 reference set seeded by migration M-020:
 *   - `metalmeccanico_industria` — CCNL Industria Metalmeccanica
 *     (Federmeccanica / Assistal + FIM / FIOM / UILM, vigente 2024-2027).
 *   - `commercio_terziario`     — CCNL Terziario, Distribuzione e Servizi
 *     (Confcommercio + Filcams / Fisascat / Uiltucs, vigente 2024-2027).
 *
 * Adding a CCNL is data-only: insert into `ccnls` + the per-CCNL
 * subordinate tables; no migration required after M-020.
 */
@Entity('ccnls')
@Index(['code'], { unique: true })
export class Ccnl {
  @PrimaryColumn({ length: 50 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100 })
  sector: string;

  @Column({ length: 50, nullable: true })
  version: string | null;

  @Column({ type: 'date', nullable: true })
  effectiveFrom: Date | null;

  @Column({ type: 'date', nullable: true })
  effectiveTo: Date | null;

  /** Source URL for traceability (Normattiva / sindacato / Confindustria). */
  @Column({ length: 500, nullable: true })
  sourceUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * CCNL pay grade — minimum monthly wage by livello / categoria.
 *
 * `monthlyMinCents` is the contractually-bound minimum (R-D04). The
 * tenant-side payroll layer (TeamFlow) computes the actual gross wage
 * from minimum + scatti d'anzianità + super-minimo.
 */
@Entity('ccnl_pay_grades')
@Index(['ccnlCode', 'code'], { unique: true })
export class CcnlPayGrade {
  @PrimaryColumn({ length: 100 })
  id: string;

  @Column({ length: 50 })
  ccnlCode: string;

  /** Contract-internal code (e.g., `liv_4`, `2A`). */
  @Column({ length: 50 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'bigint', default: 0 })
  monthlyMinCents: number;

  @Column({ type: 'numeric', precision: 4, scale: 2, default: 40 })
  weeklyHours: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * CCNL leave entitlement — days/year by leave type, possibly graded by
 * years of service. `daysPerYearByYearsOfService` keeps a JSON map so
 * the v1 ferie pattern (e.g., 22 days years 0-15, 26 days years 16+)
 * fits without per-CCNL columns.
 */
@Entity('ccnl_leave_entitlements')
@Index(['ccnlCode', 'leaveType'], { unique: true })
export class CcnlLeaveEntitlement {
  @PrimaryColumn({ length: 100 })
  id: string;

  @Column({ length: 50 })
  ccnlCode: string;

  @Column({ length: 50 })
  leaveType: string;

  /**
   * Map of "min years of service" → "days/year". Keys are strings of
   * non-negative integers. Example for ferie metalmeccanico:
   *   { "0": 22, "16": 26 }
   * means "0..15 years → 22 days; 16+ years → 26 days".
   */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  daysPerYearByYearsOfService: Record<string, number>;

  @Column({ length: 500, nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
