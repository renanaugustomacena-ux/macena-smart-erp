import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * ReadModelRow — generic CQRS projection row (plan §31.1 Sprint 18 / S18.1; ADR-010).
 *
 * Every projection writes denormalised rows here keyed by:
 *   (tenantId, projectionId, key)
 *
 * `projectionId` identifies the projection (e.g.,
 * `daily_invoice_totals`); `key` is the projection-defined natural key
 * (e.g., the ISO date for a daily projection, the product UUID for a
 * per-product projection); `payload` is the projected JSON.
 *
 * `version` is bumped on every overwrite — the projection consumer
 * uses it for optimistic concurrency when running multiple workers.
 *
 * Single-table-per-projection-type was rejected for v1 (proliferates
 * tables without a real query benefit at our scale). Once a projection
 * grows past ~10M rows or needs columnar query patterns, ADR-010
 * authorises promoting that single projection to a dedicated table.
 */
@Entity('read_model_rows')
@Index(['tenantId', 'projectionId', 'key'], { unique: true })
@Index(['tenantId', 'projectionId', 'updatedAt'])
@Index(['projectionId', 'updatedAt'])
export class ReadModelRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 100 })
  projectionId: string;

  @Column({ length: 200 })
  key: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'int', default: 1 })
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

/**
 * ProjectionCursor — per-projection running state (last-processed
 * timestamp + last-processed-id) so rebuilds are resumable.
 */
@Entity('projection_cursors')
@Index(['tenantId', 'projectionId'], { unique: true })
export class ProjectionCursor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 100 })
  projectionId: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastProcessedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  lastProcessedSourceId: string | null;

  @Column({ type: 'int', default: 0 })
  rowsProjected: number;

  @Column({
    type: 'enum',
    enum: ['idle', 'running', 'failed'],
    default: 'idle',
  })
  status: 'idle' | 'running' | 'failed';

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
