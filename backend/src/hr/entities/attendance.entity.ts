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
 * Attendance — daily presenze record per employee
 * (plan §31.1 Sprint 17 / S17.2).
 *
 * One row per (employeeId, date). The clock-in / clock-out cycle is
 * idempotent within a single day: re-clocking-in updates `clockInAt`,
 * re-clocking-out updates `clockOutAt` and recomputes `workedHours`.
 *
 * Status FSM:
 *   open       → closed       (manual or via clock-out)
 *   open       → auto_closed  (the cron sweeper at 23:59 closes orphans)
 *   closed, auto_closed       — terminal
 */
export type AttendanceStatus = 'open' | 'closed' | 'auto_closed';

export type AttendanceLocation =
  | 'office'
  | 'remote'
  | 'site'
  | 'travel'
  | 'other';

@Entity('attendances')
@Index(['tenantId', 'employeeId', 'date'], { unique: true })
@Index(['tenantId', 'date'])
@Index(['tenantId', 'employeeId', 'status'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'uuid' })
  employeeId: string;

  /** Calendar date (Europe/Rome) the attendance row tracks. */
  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'timestamptz', nullable: true })
  clockInAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  clockOutAt: Date | null;

  /** Total break time in minutes deducted from the gross worked window. */
  @Column({ type: 'int', default: 0 })
  breakMinutes: number;

  /** Computed at clock-out (gross window - breaks). Cached for reporting. */
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  workedHours: string;

  @Column({
    type: 'enum',
    enum: ['office', 'remote', 'site', 'travel', 'other'],
    default: 'office',
  })
  location: AttendanceLocation;

  @Column({ length: 100, nullable: true })
  locationLabel: string | null;

  @Column({
    type: 'enum',
    enum: ['open', 'closed', 'auto_closed'],
    default: 'open',
  })
  status: AttendanceStatus;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  /** UUID of the actor who created the row (typically the employee). */
  @Column({ type: 'uuid', nullable: true })
  recordedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
