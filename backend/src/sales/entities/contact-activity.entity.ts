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
 * ContactActivity — CRM-side record of every interaction the platform
 * has with a customer (and, optionally, with a specific contact person
 * inside that customer's organisation). Drives the sales pipeline view
 * and provides an audit trail for "who said what when".
 *
 * Plan §31.1 Sprint 15 / S15.3.
 *
 * `kind` enumerates the canonical interaction shape; `direction`
 * separates inbound from outbound. `linkedEntityType` + `linkedEntityId`
 * is a polymorphic pointer so a call about a quotation, a sales order,
 * or a complaint about an invoice can all coexist in one stream.
 */
export type ContactActivityKind =
  | 'call'
  | 'email'
  | 'meeting'
  | 'demo'
  | 'visit'
  | 'note';

export type ContactActivityDirection = 'inbound' | 'outbound' | 'internal';

export type ContactActivityLinkedEntityType =
  | 'customer'
  | 'quotation'
  | 'sales_order'
  | 'invoice'
  | 'ddt'
  | 'rfq'
  | 'complaint';

@Entity('contact_activities')
@Index(['tenantId', 'customerId', 'occurredAt'])
@Index(['tenantId', 'kind', 'occurredAt'])
@Index(['tenantId', 'linkedEntityType', 'linkedEntityId'])
@Index(['tenantId', 'occurredAt'])
export class ContactActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ type: 'uuid' })
  customerId: string;

  /** Optional FK to a `contact_persons` row (Sprint 16 will materialise that table). */
  @Column({ type: 'uuid', nullable: true })
  contactPersonId: string | null;

  @Column({
    type: 'enum',
    enum: ['call', 'email', 'meeting', 'demo', 'visit', 'note'],
  })
  kind: ContactActivityKind;

  @Column({
    type: 'enum',
    enum: ['inbound', 'outbound', 'internal'],
    default: 'outbound',
  })
  direction: ContactActivityDirection;

  /** RFC 3339 UTC. */
  @Column({ type: 'timestamptz' })
  occurredAt: Date;

  @Column({ type: 'int', nullable: true })
  durationMinutes: number | null;

  @Column({ length: 200 })
  @DataClassification('confidential')
  subject: string;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  body: string | null;

  /** Polymorphic anchor — keeps the activity stream domain-agnostic. */
  @Column({
    type: 'enum',
    enum: [
      'customer',
      'quotation',
      'sales_order',
      'invoice',
      'ddt',
      'rfq',
      'complaint',
    ],
    default: 'customer',
  })
  linkedEntityType: ContactActivityLinkedEntityType;

  @Column({ type: 'uuid', nullable: true })
  linkedEntityId: string | null;

  /** UUID of the user who logged the activity. */
  @Column({ type: 'uuid' })
  recordedBy: string;

  /** Tenant-defined tags / labels (e.g. ['follow_up', 'price_negotiation']). */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  tags: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
