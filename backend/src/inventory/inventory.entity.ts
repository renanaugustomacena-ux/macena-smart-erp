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

export enum ProductCategory {
  RAW_MATERIAL = 'raw_material',
  SEMI_FINISHED = 'semi_finished',
  FINISHED_PRODUCT = 'finished_product',
  CONSUMABLE = 'consumable',
  PACKAGING = 'packaging',
  SPARE_PART = 'spare_part',
}

export enum UnitOfMeasure {
  PIECE = 'pz',
  KILOGRAM = 'kg',
  GRAM = 'g',
  LITER = 'l',
  METER = 'm',
  SQUARE_METER = 'mq',
  CUBIC_METER = 'mc',
  BOX = 'box',
  PALLET = 'pallet',
}

export enum StockMovementType {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment',
  PRODUCTION_CONSUMPTION = 'production_consumption',
  PRODUCTION_OUTPUT = 'production_output',
  RETURN = 'return',
  SCRAP = 'scrap',
}

@Entity('products')
@Index(['tenantId', 'sku'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  sku: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ProductCategory })
  category: ProductCategory;

  @Column({ type: 'enum', enum: UnitOfMeasure, default: UnitOfMeasure.PIECE })
  unitOfMeasure: UnitOfMeasure;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  sellingPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  weight: number;

  @Column({ length: 50, nullable: true })
  barcode: string;

  @Column({ type: 'int', default: 0 })
  minimumStock: number;

  @Column({ type: 'int', default: 0 })
  reorderPoint: number;

  @Column({ type: 'int', default: 0 })
  reorderQuantity: number;

  @Column({ type: 'int', default: 0 })
  leadTimeDays: number;

  @Column({ length: 100, nullable: true })
  supplier: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @OneToMany(() => StockLevel, (stockLevel) => stockLevel.product)
  stockLevels: StockLevel[];

  @OneToMany(() => StockMovement, (movement) => movement.product)
  movements: StockMovement[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('warehouses')
@Index(['tenantId', 'code'], { unique: true })
export class Warehouse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 20 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ length: 5, nullable: true })
  postalCode: string;

  @Column({ length: 100, nullable: true })
  province: string;

  @Column({ length: 100, nullable: true })
  contactPerson: string;

  @Column({ length: 20, nullable: true })
  contactPhone: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  capacitySquareMeters: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  zones: { name: string; code: string; type: string }[];

  @OneToMany(() => StockLevel, (stockLevel) => stockLevel.warehouse)
  stockLevels: StockLevel[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('stock_levels')
@Index(['tenantId', 'productId', 'warehouseId'], { unique: true })
export class StockLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column()
  productId: string;

  @Column()
  warehouseId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  quantityOnHand: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  quantityReserved: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  quantityOnOrder: number;

  @Column({ length: 50, nullable: true })
  zone: string;

  @Column({ length: 50, nullable: true })
  location: string;

  @Column({ nullable: true })
  lastCountDate: Date;

  @ManyToOne(() => Product, (product) => product.stockLevels, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => Warehouse, (warehouse) => warehouse.stockLevels, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'warehouseId' })
  warehouse: Warehouse;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('stock_movements')
@Index(['tenantId', 'createdAt'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column()
  productId: string;

  @Column({ type: 'enum', enum: StockMovementType })
  movementType: StockMovementType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: number;

  @Column({ nullable: true })
  sourceWarehouseId: string;

  @Column({ nullable: true })
  destinationWarehouseId: string;

  @Column({ length: 100, nullable: true })
  referenceNumber: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ length: 100, nullable: true })
  performedBy: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitCostAtTime: number;

  @ManyToOne(() => Product, (product) => product.movements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @CreateDateColumn()
  createdAt: Date;
}
