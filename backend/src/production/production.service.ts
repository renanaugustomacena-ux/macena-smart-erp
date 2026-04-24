import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, FindOptionsWhere, LessThan, DataSource } from 'typeorm';
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
import { InventoryService } from '../inventory/inventory.service';

// ─── Enums ─────────────────────────────────────────────────────

export enum ProductionOrderStatus {
  DRAFT = 'draft',
  PLANNED = 'planned',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum WorkOrderStatus {
  PENDING = 'pending',
  READY = 'ready',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum Priority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

// ─── Entities ──────────────────────────────────────────────────

@Entity('production_orders')
@Index(['tenantId', 'orderNumber'], { unique: true })
export class ProductionOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  orderNumber: string;

  @Column({ length: 255 })
  productName: string;

  @Column({ nullable: true })
  productId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantityPlanned: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  quantityProduced: number;

  @Column({ type: 'enum', enum: ProductionOrderStatus, default: ProductionOrderStatus.DRAFT })
  status: ProductionOrderStatus;

  @Column({ type: 'enum', enum: Priority, default: Priority.NORMAL })
  priority: Priority;

  @Column({ type: 'date' })
  plannedStartDate: Date;

  @Column({ type: 'date' })
  plannedEndDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualStartDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  actualEndDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ length: 100, nullable: true })
  customerReference: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualCost: number;

  @Column({ type: 'jsonb', nullable: true })
  billOfMaterials: {
    materialId: string;
    materialName: string;
    quantityRequired: number;
    unit: string;
  }[];

  @OneToMany(() => WorkOrder, (wo) => wo.productionOrder)
  workOrders: WorkOrder[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('work_orders')
@Index(['tenantId', 'workOrderNumber'], { unique: true })
export class WorkOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({ length: 50 })
  workOrderNumber: string;

  @Column()
  productionOrderId: string;

  @Column({ length: 255 })
  operationName: string;

  @Column({ length: 100 })
  workCenter: string;

  @Column({ type: 'int' })
  sequenceNumber: number;

  @Column({ type: 'enum', enum: WorkOrderStatus, default: WorkOrderStatus.PENDING })
  status: WorkOrderStatus;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  estimatedDurationHours: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  actualDurationHours: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ length: 255, nullable: true })
  assignedTo: string;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  quantityProduced: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  quantityRejected: number;

  @Column({ type: 'jsonb', nullable: true })
  qualityChecks: {
    checkName: string;
    passed: boolean;
    value?: string;
    timestamp: string;
  }[];

  @ManyToOne(() => ProductionOrder, (po) => po.workOrders, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productionOrderId' })
  productionOrder: ProductionOrder;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── DTOs ──────────────────────────────────────────────────────

export interface CreateProductionOrderInput {
  productName: string;
  productId?: string;
  quantityPlanned: number;
  priority?: Priority;
  plannedStartDate: string;
  plannedEndDate: string;
  notes?: string;
  customerReference?: string;
  estimatedCost?: number;
  billOfMaterials?: {
    materialId: string;
    materialName: string;
    quantityRequired: number;
    unit: string;
  }[];
}

export interface CreateWorkOrderInput {
  operationName: string;
  workCenter: string;
  sequenceNumber: number;
  estimatedDurationHours?: number;
  assignedTo?: string;
  instructions?: string;
}

export interface UpdateWorkOrderStatusInput {
  status: WorkOrderStatus;
  quantityProduced?: number;
  quantityRejected?: number;
  notes?: string;
  qualityChecks?: {
    checkName: string;
    passed: boolean;
    value?: string;
  }[];
}

// ─── Service ───────────────────────────────────────────────────

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    @InjectRepository(ProductionOrder)
    private readonly productionOrderRepo: Repository<ProductionOrder>,
    @InjectRepository(WorkOrder)
    private readonly workOrderRepo: Repository<WorkOrder>,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Production Orders ─────────────────────────────────────────

  async createProductionOrder(
    tenantId: string,
    dto: CreateProductionOrderInput,
  ): Promise<ProductionOrder> {
    const orderNumber = await this.generateOrderNumber(tenantId, 'PO');
    const order = this.productionOrderRepo.create({
      ...dto,
      tenantId,
      orderNumber,
      status: ProductionOrderStatus.DRAFT,
      quantityProduced: 0,
    });
    const saved = await this.productionOrderRepo.save(order);
    this.logger.log(
      `Production order created: ${saved.orderNumber} for tenant ${tenantId}`,
    );
    return saved;
  }

  async getProductionOrders(
    tenantId: string,
    status?: ProductionOrderStatus,
    page: number = 1,
    limit: number = 20,
  ) {
    const where: FindOptionsWhere<ProductionOrder> = { tenantId };
    if (status) where.status = status;
    const [data, total] = await this.productionOrderRepo.findAndCount({
      where,
      relations: ['workOrders'],
      order: { priority: 'ASC', plannedStartDate: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProductionOrderById(
    tenantId: string,
    orderId: string,
  ): Promise<ProductionOrder> {
    const order = await this.productionOrderRepo.findOne({
      where: { id: orderId, tenantId },
      relations: ['workOrders'],
    });
    if (!order) {
      throw new NotFoundException(`Production order ${orderId} not found`);
    }
    return order;
  }

  async updateProductionOrderStatus(
    tenantId: string,
    orderId: string,
    newStatus: ProductionOrderStatus,
  ): Promise<ProductionOrder> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(ProductionOrder);
      const order = await orderRepo.findOne({
        where: { id: orderId, tenantId },
        relations: ['workOrders'],
      });
      if (!order) {
        throw new NotFoundException(`Production order ${orderId} not found`);
      }

      const validTransitions: Record<ProductionOrderStatus, ProductionOrderStatus[]> = {
        [ProductionOrderStatus.DRAFT]: [ProductionOrderStatus.PLANNED, ProductionOrderStatus.CANCELLED],
        [ProductionOrderStatus.PLANNED]: [ProductionOrderStatus.CONFIRMED, ProductionOrderStatus.CANCELLED],
        [ProductionOrderStatus.CONFIRMED]: [ProductionOrderStatus.IN_PROGRESS, ProductionOrderStatus.CANCELLED],
        [ProductionOrderStatus.IN_PROGRESS]: [ProductionOrderStatus.COMPLETED, ProductionOrderStatus.CANCELLED],
        [ProductionOrderStatus.COMPLETED]: [],
        [ProductionOrderStatus.CANCELLED]: [],
      };

      if (!validTransitions[order.status]?.includes(newStatus)) {
        throw new BadRequestException(
          `Cannot transition from ${order.status} to ${newStatus}`,
        );
      }

      // BOM expansion: when the order moves to IN_PROGRESS, consume raw
      // materials from the default warehouse. (Per plan §5.1 "BOM expansion
      // for production orders".)
      if (newStatus === ProductionOrderStatus.IN_PROGRESS && order.billOfMaterials?.length) {
        await this.inventoryService.consumeBomForProductionOrder(tenantId, {
          reference: `PO:${order.orderNumber}`,
          bom: order.billOfMaterials.map((b) => ({
            materialId: b.materialId,
            quantityRequired: Number(b.quantityRequired) * Number(order.quantityPlanned),
          })),
        });
      }

      order.status = newStatus;
      if (newStatus === ProductionOrderStatus.IN_PROGRESS && !order.actualStartDate) {
        order.actualStartDate = new Date();
      }
      if (newStatus === ProductionOrderStatus.COMPLETED) {
        order.actualEndDate = new Date();
      }
      const saved = await orderRepo.save(order);
      this.logger.log(
        `Production order ${order.orderNumber} status -> ${newStatus}`,
      );
      return saved;
    });
  }

  // ─── Work Orders ───────────────────────────────────────────────

  async createWorkOrder(
    tenantId: string,
    productionOrderId: string,
    dto: CreateWorkOrderInput,
  ): Promise<WorkOrder> {
    await this.getProductionOrderById(tenantId, productionOrderId);
    const workOrderNumber = await this.generateWorkOrderNumber(tenantId);
    const workOrder = this.workOrderRepo.create({
      ...dto,
      tenantId,
      productionOrderId,
      workOrderNumber,
      status: WorkOrderStatus.PENDING,
    });
    const saved = await this.workOrderRepo.save(workOrder);
    this.logger.log(
      `Work order created: ${saved.workOrderNumber} for PO ${productionOrderId}`,
    );
    return saved;
  }

  async getWorkOrders(
    tenantId: string,
    status?: string,
    workCenter?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const where: FindOptionsWhere<WorkOrder> = { tenantId };
    if (status) where.status = status as WorkOrderStatus;
    if (workCenter) where.workCenter = workCenter;
    const [data, total] = await this.workOrderRepo.findAndCount({
      where,
      relations: ['productionOrder'],
      order: { sequenceNumber: 'ASC', createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateWorkOrderStatus(
    tenantId: string,
    workOrderId: string,
    dto: UpdateWorkOrderStatusInput,
  ): Promise<WorkOrder> {
    const workOrder = await this.workOrderRepo.findOne({
      where: { id: workOrderId, tenantId },
      relations: ['productionOrder'],
    });
    if (!workOrder) {
      throw new NotFoundException(`Work order ${workOrderId} not found`);
    }
    workOrder.status = dto.status;
    if (dto.status === WorkOrderStatus.IN_PROGRESS && !workOrder.startedAt) {
      workOrder.startedAt = new Date();
    }
    if (dto.status === WorkOrderStatus.COMPLETED) {
      workOrder.completedAt = new Date();
      if (workOrder.startedAt) {
        workOrder.actualDurationHours =
          (workOrder.completedAt.getTime() - workOrder.startedAt.getTime()) /
          (1000 * 60 * 60);
      }
    }
    if (dto.quantityProduced !== undefined) {
      workOrder.quantityProduced = dto.quantityProduced;
    }
    if (dto.quantityRejected !== undefined) {
      workOrder.quantityRejected = dto.quantityRejected;
    }
    if (dto.notes) workOrder.notes = dto.notes;
    if (dto.qualityChecks) {
      workOrder.qualityChecks = dto.qualityChecks.map((qc) => ({
        ...qc,
        timestamp: new Date().toISOString(),
      }));
    }
    const saved = await this.workOrderRepo.save(workOrder);
    if (dto.status === WorkOrderStatus.COMPLETED && dto.quantityProduced) {
      await this.updateProductionOrderQuantity(
        tenantId,
        workOrder.productionOrderId,
      );
    }
    return saved;
  }

  // ─── Dashboard & Analytics ─────────────────────────────────────

  async getDashboardMetrics(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [activeOrders, completedToday, overdueOrders, allWorkOrders] =
      await Promise.all([
        this.productionOrderRepo.count({
          where: {
            tenantId,
            status: In([
              ProductionOrderStatus.CONFIRMED,
              ProductionOrderStatus.IN_PROGRESS,
            ]),
          },
        }),
        this.productionOrderRepo.count({
          where: {
            tenantId,
            status: ProductionOrderStatus.COMPLETED,
            actualEndDate: Between(today, tomorrow),
          },
        }),
        this.productionOrderRepo.count({
          where: {
            tenantId,
            status: In([
              ProductionOrderStatus.CONFIRMED,
              ProductionOrderStatus.IN_PROGRESS,
            ]),
            plannedEndDate: LessThan(today),
          },
        }),
        this.workOrderRepo.find({
          where: { tenantId, status: In([WorkOrderStatus.COMPLETED]) },
          select: ['workCenter', 'estimatedDurationHours', 'actualDurationHours'],
        }),
      ]);

    let totalEstimated = 0;
    let totalActual = 0;
    const workCenterUtilization: Record<
      string,
      { estimated: number; actual: number; efficiency: number }
    > = {};
    for (const wo of allWorkOrders) {
      const est = Number(wo.estimatedDurationHours) || 0;
      const act = Number(wo.actualDurationHours) || 0;
      totalEstimated += est;
      totalActual += act;
      if (!workCenterUtilization[wo.workCenter]) {
        workCenterUtilization[wo.workCenter] = { estimated: 0, actual: 0, efficiency: 0 };
      }
      workCenterUtilization[wo.workCenter].estimated += est;
      workCenterUtilization[wo.workCenter].actual += act;
    }
    for (const wc of Object.keys(workCenterUtilization)) {
      const { estimated, actual } = workCenterUtilization[wc];
      workCenterUtilization[wc].efficiency =
        actual > 0 ? Math.round((estimated / actual) * 100) : 0;
    }
    const overallEfficiency =
      totalActual > 0 ? Math.round((totalEstimated / totalActual) * 100) : 0;
    return {
      activeOrders,
      completedToday,
      overdueOrders,
      efficiency: overallEfficiency,
      workCenterUtilization,
    };
  }

  async getProductionSchedule(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const orders = await this.productionOrderRepo.find({
      where: {
        tenantId,
        plannedStartDate: Between(startDate, endDate),
        status: In([
          ProductionOrderStatus.PLANNED,
          ProductionOrderStatus.CONFIRMED,
          ProductionOrderStatus.IN_PROGRESS,
        ]),
      },
      relations: ['workOrders'],
      order: { plannedStartDate: 'ASC' },
    });
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      orders,
      totalOrders: orders.length,
    };
  }

  // ─── Private helpers ───────────────────────────────────────────

  private async generateOrderNumber(
    tenantId: string,
    prefix: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.productionOrderRepo.count({ where: { tenantId } });
    const sequence = String(count + 1).padStart(5, '0');
    return `${prefix}-${year}-${sequence}`;
  }

  private async generateWorkOrderNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.workOrderRepo.count({ where: { tenantId } });
    return `WO-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async updateProductionOrderQuantity(
    tenantId: string,
    productionOrderId: string,
  ): Promise<void> {
    const workOrders = await this.workOrderRepo.find({
      where: {
        tenantId,
        productionOrderId,
        status: WorkOrderStatus.COMPLETED,
      },
    });
    const lastWorkOrder = workOrders.sort(
      (a, b) => b.sequenceNumber - a.sequenceNumber,
    )[0];
    if (lastWorkOrder?.quantityProduced) {
      await this.productionOrderRepo.update(productionOrderId, {
        quantityProduced: lastWorkOrder.quantityProduced,
      });
    }
  }
}
