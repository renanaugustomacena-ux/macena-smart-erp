import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike, DataSource } from 'typeorm';
import {
  Customer,
  CustomerType,
  SalesOrder,
  SalesOrderStatus,
} from './sales.entity';
import { InventoryService } from '../inventory/inventory.service';
import { Warehouse } from '../inventory/inventory.entity';
import { MetricsService } from '../metrics/metrics.service';

export interface CreateCustomerInput {
  code: string;
  name: string;
  customerType?: CustomerType;
  vatNumber?: string;
  fiscalCode?: string;
  sdiDestinationCode?: string;
  pecEmail?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
  defaultIvaRate?: number;
  paymentTermsDays?: number;
  splitPayment?: boolean;
  notes?: Record<string, unknown>;
}

export interface CreateSalesOrderInput {
  customerId: string;
  orderDate: string;
  requestedDeliveryDate?: string;
  customerPoReference?: string;
  notes?: string;
  lines: {
    productId: string;
    sku: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountPct?: number;
    ivaRate: number;
    warehouseId?: string;
  }[];
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(SalesOrder)
    private readonly salesOrderRepo: Repository<SalesOrder>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
    private readonly inventoryService: InventoryService,
    private readonly dataSource: DataSource,
    private readonly metrics: MetricsService,
  ) {}

  // ─── Customers ─────────────────────────────────────────────────

  async createCustomer(tenantId: string, dto: CreateCustomerInput): Promise<Customer> {
    const existing = await this.customerRepo.findOne({
      where: { tenantId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(
        `Customer code ${dto.code} already exists for this tenant`,
      );
    }
    const customer = this.customerRepo.create({ ...dto, tenantId });
    const saved = await this.customerRepo.save(customer);
    this.logger.log(`Customer created: ${saved.id} (${saved.code})`);
    return saved;
  }

  async listCustomers(
    tenantId: string,
    filter: { search?: string; page?: number; limit?: number } = {},
  ) {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 20, 100);
    const where: FindOptionsWhere<Customer> = { tenantId, isActive: true };
    if (filter.search) where.name = ILike(`%${filter.search}%`);
    const [data, total] = await this.customerRepo.findAndCount({
      where,
      order: { name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCustomer(tenantId: string, id: string): Promise<Customer> {
    const customer = await this.customerRepo.findOne({
      where: { id, tenantId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }
    return customer;
  }

  // ─── Sales Orders ──────────────────────────────────────────────

  async createSalesOrder(
    tenantId: string,
    dto: CreateSalesOrderInput,
  ): Promise<SalesOrder> {
    const customer = await this.getCustomer(tenantId, dto.customerId);
    const orderNumber = await this.nextOrderNumber(tenantId);

    let subtotal = 0;
    let tax = 0;
    const lines = dto.lines.map((l) => {
      const discount = l.discountPct ?? 0;
      const netPrice = l.unitPrice * (1 - discount / 100);
      const lineTotal = Number((l.quantity * netPrice).toFixed(2));
      subtotal += lineTotal;
      tax += Number(((lineTotal * l.ivaRate) / 100).toFixed(2));
      return { ...l, lineTotal };
    });

    const splitPayment = customer.splitPayment;
    const taxAmount = splitPayment ? 0 : Number(tax.toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    const order = this.salesOrderRepo.create({
      tenantId,
      orderNumber,
      customerId: dto.customerId,
      status: SalesOrderStatus.DRAFT,
      orderDate: new Date(dto.orderDate),
      requestedDeliveryDate: dto.requestedDeliveryDate
        ? new Date(dto.requestedDeliveryDate)
        : undefined,
      customerPoReference: dto.customerPoReference,
      notes: dto.notes,
      lines,
      subtotalAmount: Number(subtotal.toFixed(2)),
      taxAmount,
      totalAmount,
    });

    const saved = await this.salesOrderRepo.save(order);
    this.metrics.increment('smarterp_sales_orders_total');
    this.logger.log(`Sales order created: ${saved.orderNumber} total=${saved.totalAmount}`);
    return saved;
  }

  async listSalesOrders(
    tenantId: string,
    filter: { status?: SalesOrderStatus; page?: number; limit?: number } = {},
  ) {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 20, 100);
    const where: FindOptionsWhere<SalesOrder> = { tenantId };
    if (filter.status) where.status = filter.status;
    const [data, total] = await this.salesOrderRepo.findAndCount({
      where,
      relations: ['customer'],
      order: { orderDate: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getSalesOrder(tenantId: string, id: string): Promise<SalesOrder> {
    const order = await this.salesOrderRepo.findOne({
      where: { id, tenantId },
      relations: ['customer'],
    });
    if (!order) {
      throw new NotFoundException(`Sales order ${id} not found`);
    }
    return order;
  }

  /**
   * Confirm a draft sales order AND reserve stock for every line that
   * references an inventory product. Per plan §5.1: "stock reservation on
   * order". If any line cannot be reserved, the whole confirm rolls back.
   */
  async confirmSalesOrder(tenantId: string, id: string): Promise<SalesOrder> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(SalesOrder);
      const order = await orderRepo.findOne({ where: { id, tenantId } });
      if (!order) {
        throw new NotFoundException(`Sales order ${id} not found`);
      }
      if (order.status !== SalesOrderStatus.DRAFT) {
        throw new BadRequestException(
          `Only DRAFT orders can be confirmed; current status: ${order.status}`,
        );
      }
      const defaultWarehouseId = await this.pickDefaultWarehouseId(tenantId);
      const reservationRequests = order.lines
        .filter((l) => !!l.productId)
        .map((l) => ({
          productId: l.productId,
          warehouseId: l.warehouseId ?? defaultWarehouseId,
          quantity: Number(l.quantity),
          reference: `SO:${order.orderNumber}`,
        }));
      if (reservationRequests.length) {
        await this.inventoryService.reserveStock(tenantId, reservationRequests);
      }
      order.status = SalesOrderStatus.CONFIRMED;
      return orderRepo.save(order);
    });
  }

  /**
   * Cancel a confirmed order and release reserved stock.
   */
  async cancelSalesOrder(tenantId: string, id: string): Promise<SalesOrder> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(SalesOrder);
      const order = await orderRepo.findOne({ where: { id, tenantId } });
      if (!order) {
        throw new NotFoundException(`Sales order ${id} not found`);
      }
      if (order.status === SalesOrderStatus.SHIPPED || order.status === SalesOrderStatus.INVOICED) {
        throw new BadRequestException(
          `Cannot cancel ${order.orderNumber}: already shipped/invoiced`,
        );
      }
      if (order.status === SalesOrderStatus.CONFIRMED || order.status === SalesOrderStatus.PARTIALLY_SHIPPED) {
        const defaultWarehouseId = await this.pickDefaultWarehouseId(tenantId);
        const releaseRequests = order.lines
          .filter((l) => !!l.productId)
          .map((l) => ({
            productId: l.productId,
            warehouseId: l.warehouseId ?? defaultWarehouseId,
            quantity: Number(l.quantity),
            reference: `SO:${order.orderNumber}`,
          }));
        if (releaseRequests.length) {
          await this.inventoryService.releaseReservation(tenantId, releaseRequests);
        }
      }
      order.status = SalesOrderStatus.CANCELLED;
      return orderRepo.save(order);
    });
  }

  /**
   * Ship a confirmed sales order. Decrements on-hand stock.
   */
  async shipSalesOrder(tenantId: string, id: string): Promise<SalesOrder> {
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(SalesOrder);
      const order = await orderRepo.findOne({ where: { id, tenantId } });
      if (!order) {
        throw new NotFoundException(`Sales order ${id} not found`);
      }
      if (order.status !== SalesOrderStatus.CONFIRMED) {
        throw new BadRequestException(
          `Only CONFIRMED orders can be shipped; status: ${order.status}`,
        );
      }
      const defaultWarehouseId = await this.pickDefaultWarehouseId(tenantId);
      const shipRequests = order.lines
        .filter((l) => !!l.productId)
        .map((l) => ({
          productId: l.productId,
          warehouseId: l.warehouseId ?? defaultWarehouseId,
          quantity: Number(l.quantity),
          reference: `SO:${order.orderNumber}`,
        }));
      if (shipRequests.length) {
        await this.inventoryService.shipReservation(tenantId, shipRequests);
      }
      order.status = SalesOrderStatus.SHIPPED;
      return orderRepo.save(order);
    });
  }

  // ─── helpers ───────────────────────────────────────────────────

  private async nextOrderNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.salesOrderRepo.count({ where: { tenantId } });
    return `SO-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async pickDefaultWarehouseId(tenantId: string): Promise<string> {
    const w = await this.warehouseRepo.findOne({
      where: { tenantId, isActive: true },
      order: { code: 'ASC' },
    });
    if (!w) {
      throw new BadRequestException(
        'Tenant has no active warehouse; cannot reserve/ship stock. Create a warehouse first.',
      );
    }
    return w.id;
  }
}
