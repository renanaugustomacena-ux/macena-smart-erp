import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DataClassification } from '../common/data-classification.decorator';

/**
 * Membership — joins one User to N Tenants with a per-tenant role.
 *
 * The "Andrea pattern" (plan §3.1.6): a commercialista belongs to ~80
 * client tenants without each one having to re-create the user account.
 * Login establishes the user identity; a tenant switch endpoint
 * (`POST /api/memberships/switch`) re-mints the JWT with the requested
 * `tenantId` claim, after verifying the user holds an `active` membership
 * for that tenant.
 *
 * `User.tenantId` (legacy column) remains the user's home tenant; it is
 * also represented as a Membership row so the same auth + RBAC code paths
 * apply. The migration M-019 backfills home memberships for every existing
 * user.
 *
 * `consent` semantics:
 *   - status = 'pending'  — tenant admin has invited the user; the user
 *                            (commercialista) has not yet consented.
 *   - status = 'active'   — both sides agreed; the membership is usable.
 *   - status = 'revoked'  — either side revoked; switching denied.
 */
export type MembershipRole =
  | 'admin'
  | 'manager'
  | 'operator'
  | 'viewer'
  | 'commercialista';

export type MembershipStatus = 'pending' | 'active' | 'revoked';

@Entity('memberships')
@Index(['tenantId', 'userId'], { unique: true })
@Index(['userId', 'status'])
@Index(['tenantId', 'role', 'status'])
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ['admin', 'manager', 'operator', 'viewer', 'commercialista'],
    default: 'viewer',
  })
  role: MembershipRole;

  @Column({
    type: 'enum',
    enum: ['pending', 'active', 'revoked'],
    default: 'pending',
  })
  status: MembershipStatus;

  /** When the tenant admin invited this user. */
  @Column({ type: 'timestamptz', nullable: true })
  invitedAt: Date | null;

  /** When the user (commercialista) consented to the membership. */
  @Column({ type: 'timestamptz', nullable: true })
  consentedAt: Date | null;

  /** Effective grant timestamp (= when status moved to 'active'). */
  @Column({ type: 'timestamptz', nullable: true })
  grantedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  invitedBy: string | null;

  @Column({ type: 'uuid', nullable: true })
  revokedBy: string | null;

  /** Optional fine-grained scopes (v2). v1 leaves this empty. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  scopes: string[];

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
