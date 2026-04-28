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
 * Employee — anagrafica dipendente (plan §31.1 Sprint 17 / S17.1).
 *
 * The "HR-lite" scope: the platform tracks who the employees are,
 * which CCNL applies, what grade and weekly hours they work, and the
 * monetary wage. **Full payroll computation** (CU, F24, UNIEMENS,
 * CCNL gross-to-net) lives in the TeamFlow project per ADR-001 + the
 * `payroll-adjacent/` integration stub. SmartERP-side `Employee` is the
 * source of truth for the people roster; TeamFlow consumes it via the
 * cross-product Membership pattern.
 *
 * Italian fiscal anchors:
 *   - D.Lgs. 81/2015 (Jobs Act) — contract-type taxonomy.
 *   - D.Lgs. 151/2001 — congedo parentale.
 *   - DPR 633/1972 + UNIEMENS v4.13 (TeamFlow, not SmartERP).
 *
 * State machine (R-D07; plan §31.1 Sprint 17 / S17.1):
 *   prospect    → onboarding              (an offer is out)
 *   onboarding  → active                  (contract signed; first day worked)
 *   active      → terminated              (contract end)
 *   prospect    → terminated              (offer withdrawn / refused)
 *   onboarding  → terminated              (contract cancelled before start)
 *   terminated                            — terminal
 *
 * `on_leave` is intentionally NOT a state — leave is tracked through
 * `LeaveRequest` rows and derived ("is currently on approved leave?")
 * from the request range, so an employee remains `active` while on
 * vacation.
 */
export type EmployeeStatus =
  | 'prospect'
  | 'onboarding'
  | 'active'
  | 'terminated';

export type EmployeeContractType =
  | 'indeterminato'
  | 'determinato'
  | 'apprendistato'
  | 'somministrazione'
  | 'cococo'
  | 'stage'
  | 'collaborazione_occasionale';

@Entity('employees')
@Index(['tenantId', 'employeeNumber'], { unique: true })
@Index(['tenantId', 'status'])
@Index(['tenantId', 'fiscalCode'], {
  unique: true,
  where: '"fiscalCode" IS NOT NULL',
})
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  @DataClassification('confidential')
  employeeNumber: string;

  @Column({ length: 100 })
  @DataClassification('confidential')
  firstName: string;

  @Column({ length: 100 })
  @DataClassification('confidential')
  lastName: string;

  @Column({ length: 16, nullable: true })
  @DataClassification('confidential')
  fiscalCode: string | null;

  @Column({ length: 255, nullable: true })
  @DataClassification('confidential')
  email: string | null;

  @Column({ length: 30, nullable: true })
  @DataClassification('confidential')
  phone: string | null;

  @Column({ type: 'date', nullable: true })
  @DataClassification('confidential')
  dateOfBirth: Date | null;

  @Column({ length: 100, nullable: true })
  @DataClassification('confidential')
  placeOfBirth: string | null;

  @Column({ length: 2, nullable: true })
  nationality: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  @DataClassification('confidential')
  residenceAddress: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: [
      'indeterminato',
      'determinato',
      'apprendistato',
      'somministrazione',
      'cococo',
      'stage',
      'collaborazione_occasionale',
    ],
    default: 'indeterminato',
  })
  contractType: EmployeeContractType;

  /** CCNL identifier (e.g., `metalmeccanico_industria`). FK to `ccnls.code`. */
  @Column({ length: 50, nullable: true })
  ccnlCode: string | null;

  /** Pay grade code (e.g., `liv_4`). FK to `ccnl_pay_grades.code` within the chosen CCNL. */
  @Column({ length: 50, nullable: true })
  payGradeCode: string | null;

  /** Contractual weekly hours; typical CCNL value 40.0. */
  @Column({ type: 'numeric', precision: 4, scale: 2, default: 40 })
  weeklyHours: string;

  /**
   * Monthly wage in cents (R-D04). Mutually exclusive in practice with
   * `hourlyWageCents`; the FSM uses whichever is non-zero. Both stored
   * as bigint for safety.
   */
  @Column({ type: 'bigint', default: 0 })
  monthlyWageCents: number;

  @Column({ type: 'bigint', default: 0 })
  hourlyWageCents: number;

  @Column({ type: 'date', nullable: true })
  hireDate: Date | null;

  @Column({ type: 'date', nullable: true })
  terminationDate: Date | null;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  terminationReason: string | null;

  @Column({
    type: 'enum',
    enum: ['prospect', 'onboarding', 'active', 'terminated'],
    default: 'prospect',
  })
  status: EmployeeStatus;

  /** Optional link to a `users` row when the employee has portal access. */
  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  /** Direct manager — another `employees` row. */
  @Column({ type: 'uuid', nullable: true })
  managerEmployeeId: string | null;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
