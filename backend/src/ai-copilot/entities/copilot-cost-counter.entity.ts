import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Per-tenant per-day Copilot cost counter (plan §31.2 Sprint 25 / S25.5).
 *
 * Tokens are accumulated into a single row per (tenantId, date) so the
 * cost-cap guard can short-circuit further calls when the daily ceiling
 * is exceeded. The cap itself is configured per-tier on the Tenant
 * settings blob (`tenant.settings.aiCopilot.dailyTokenCap`).
 */
@Entity('copilot_cost_counters')
@Index(['tenantId', 'date'], { unique: true })
@Index(['date'])
export class CopilotCostCounter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'bigint', default: 0 })
  inputTokens: number;

  @Column({ type: 'bigint', default: 0 })
  outputTokens: number;

  @Column({ type: 'bigint', default: 0 })
  cacheCreationTokens: number;

  @Column({ type: 'bigint', default: 0 })
  cacheReadTokens: number;

  /** Number of completed (non-error) Copilot turns. */
  @Column({ type: 'int', default: 0 })
  turnsCount: number;

  /**
   * Number of turns rejected by the cost cap. Used by the
   * Compliance dashboard.
   */
  @Column({ type: 'int', default: 0 })
  capRejectionsCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
