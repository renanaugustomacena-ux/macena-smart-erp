import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { DataClassification } from '../common/data-classification.decorator';

export enum CustomerType {
  BUSINESS = 'business',
  PUBLIC_ADMINISTRATION = 'public_administration',
  INDIVIDUAL = 'individual',
  FOREIGN = 'foreign',
}

export enum SalesOrderStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  PARTIALLY_SHIPPED = 'partially_shipped',
  SHIPPED = 'shipped',
  INVOICED = 'invoiced',
  CANCELLED = 'cancelled',
}

/**
 * Customer (Anagrafica Cliente) including Italian fiscal identifiers needed
 * for FatturaPA XML CessionarioCommittente block.
 */
@Entity('customers')
@Index(['tenantId', 'code'], { unique: true })
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  @DataClassification('confidential')
  code: string;

  @Column({ length: 255 })
  @DataClassification('confidential')
  name: string;

  @Column({ type: 'enum', enum: CustomerType, default: CustomerType.BUSINESS })
  @DataClassification('confidential')
  customerType: CustomerType;

  @Column({ length: 11, nullable: true })
  @DataClassification('confidential')
  vatNumber: string;

  @Column({ length: 16, nullable: true })
  @DataClassification('confidential')
  fiscalCode: string;

  /** SDI Codice Destinatario for FatturaPA routing. '0000000' if PEC-only. */
  @Column({ length: 7, nullable: true })
  @DataClassification('confidential')
  sdiDestinationCode: string;

  @Column({ length: 255, nullable: true })
  @DataClassification('confidential')
  pecEmail: string;

  @Column({ length: 255, nullable: true })
  @DataClassification('confidential')
  email: string;

  @Column({ length: 30, nullable: true })
  @DataClassification('confidential')
  phone: string;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  address: string;

  @Column({ length: 100, nullable: true })
  @DataClassification('confidential')
  city: string;

  @Column({ length: 5, nullable: true })
  @DataClassification('confidential')
  postalCode: string;

  @Column({ length: 2, nullable: true })
  @DataClassification('confidential')
  province: string;

  @Column({ length: 2, default: 'IT' })
  @DataClassification('public')
  country: string;

  /** Default IVA rate (%) applied to sales; can be overridden per line. */
  @Column({ type: 'int', default: 22 })
  defaultIvaRate: number;

  /** Payment terms in days (0, 30, 60, 90, ...). */
  @Column({ type: 'int', default: 30 })
  paymentTermsDays: number;

  /**
   * Split payment (art. 17-ter DPR 633/1972) — typically TRUE for PA customers.
   */
  @Column({ type: 'boolean', default: false })
  splitPayment: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  notes: Record<string, unknown>;

  @OneToMany(() => SalesOrder, (order) => order.customer)
  salesOrders: SalesOrder[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('sales_orders')
@Index(['tenantId', 'orderNumber'], { unique: true })
export class SalesOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  orderNumber: string;

  @Column()
  customerId: string;

  @ManyToOne(() => Customer, (customer) => customer.salesOrders, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column({ type: 'enum', enum: SalesOrderStatus, default: SalesOrderStatus.DRAFT })
  status: SalesOrderStatus;

  @Column({ type: 'date' })
  orderDate: Date;

  @Column({ type: 'date', nullable: true })
  requestedDeliveryDate: Date;

  @Column({ length: 100, nullable: true })
  customerPoReference: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotalAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  /**
   * Denormalised line items. For production use with heavy queries, migrate
   * to a sales_order_lines child table.
   */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  lines: {
    productId: string;
    sku: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountPct?: number;
    ivaRate: number;
    lineTotal: number;
  }[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
