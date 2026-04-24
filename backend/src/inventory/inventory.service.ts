import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, DataSource } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  Product,
  Warehouse,
  StockLevel,
  StockMovement,
  StockMovementType,
  ProductCategory,
} from './inventory.entity';
import { MetricsService } from '../metrics/metrics.service';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductFilter {
  tenantId: string;
  category?: ProductCategory;
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface StockMovementRequest {
  productId: string;
  movementType: StockMovementType;
  quantity: number;
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  referenceNumber?: string;
  notes?: string;
  performedBy?: string;
}

export interface ReservationRequest {
  productId: string;
  warehouseId: string;
  quantity: number;
  reference: string;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(StockLevel)
    private readonly stockLevelRepository: Repository<StockLevel>,
    @InjectRepository(StockMovement)
    private readonly stockMovementRepository: Repository<StockMovement>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly dataSource: DataSource,
    private readonly metrics: MetricsService,
  ) {}

  // ─── Product CRUD ──────────────────────────────────────────────

  async createProduct(tenantId: string, dto: {
    sku: string;
    name: string;
    description?: string;
    category: ProductCategory;
    unitOfMeasure?: Product['unitOfMeasure'];
    unitCost?: number;
    sellingPrice?: number;
    weight?: number;
    barcode?: string;
    minimumStock?: number;
    reorderPoint?: number;
    reorderQuantity?: number;
    leadTimeDays?: number;
    supplier?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Product> {
    const existing = await this.productRepository.findOne({
      where: { tenantId, sku: dto.sku },
    });
    if (existing) {
      throw new BadRequestException(`Product with SKU ${dto.sku} already exists`);
    }
    const product = this.productRepository.create({
      ...dto,
      tenantId,
      isActive: true,
    });
    const saved = await this.productRepository.save(product);
    await this.invalidateProductCache(tenantId);
    this.logger.log(`Product created: ${saved.id} (${saved.sku}) tenant=${tenantId}`);
    return saved;
  }

  async getProducts(filter: ProductFilter): Promise<PaginatedResult<Product>> {
    const page = filter.page || 1;
    const limit = Math.min(filter.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Product> = { tenantId: filter.tenantId };
    if (filter.category) where.category = filter.category;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;
    if (filter.search) where.name = Like(`%${filter.search}%`);

    const [data, total] = await this.productRepository.findAndCount({
      where,
      relations: ['stockLevels'],
      order: { createdAt: 'DESC' },
      skip,
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

  async getProductById(tenantId: string, productId: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id: productId, tenantId },
      relations: ['stockLevels', 'stockLevels.warehouse', 'movements'],
    });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    return product;
  }

  async updateProduct(
    tenantId: string,
    productId: string,
    dto: Partial<Product>,
  ): Promise<Product> {
    const product = await this.getProductById(tenantId, productId);
    Object.assign(product, dto);
    const saved = await this.productRepository.save(product);
    await this.invalidateProductCache(tenantId);
    return saved;
  }

  async deleteProduct(tenantId: string, productId: string): Promise<void> {
    const product = await this.getProductById(tenantId, productId);
    product.isActive = false;
    await this.productRepository.save(product);
    await this.invalidateProductCache(tenantId);
  }

  // ─── Warehouse CRUD ────────────────────────────────────────────

  async createWarehouse(tenantId: string, dto: {
    code: string;
    name: string;
    address?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    contactPerson?: string;
    contactPhone?: string;
    capacitySquareMeters?: number;
    zones?: { name: string; code: string; type: string }[];
  }): Promise<Warehouse> {
    const existing = await this.warehouseRepository.findOne({
      where: { tenantId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(`Warehouse with code ${dto.code} already exists`);
    }
    const warehouse = this.warehouseRepository.create({
      ...dto,
      tenantId,
      isActive: true,
    });
    return this.warehouseRepository.save(warehouse);
  }

  async getWarehouses(tenantId: string): Promise<Warehouse[]> {
    return this.warehouseRepository.find({
      where: { tenantId, isActive: true },
      relations: ['stockLevels'],
      order: { code: 'ASC' },
    });
  }

  async getWarehouseById(tenantId: string, warehouseId: string): Promise<Warehouse> {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id: warehouseId, tenantId },
      relations: ['stockLevels', 'stockLevels.product'],
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse ${warehouseId} not found`);
    }
    return warehouse;
  }

  async updateWarehouse(
    tenantId: string,
    warehouseId: string,
    dto: Partial<Warehouse>,
  ): Promise<Warehouse> {
    const warehouse = await this.getWarehouseById(tenantId, warehouseId);
    Object.assign(warehouse, dto);
    return this.warehouseRepository.save(warehouse);
  }

  // ─── Stock Management ──────────────────────────────────────────

  async getStockLevels(
    tenantId: string,
    warehouseId?: string,
  ): Promise<StockLevel[]> {
    const where: FindOptionsWhere<StockLevel> = { tenantId };
    if (warehouseId) where.warehouseId = warehouseId;
    return this.stockLevelRepository.find({
      where,
      relations: ['product', 'warehouse'],
      order: { updatedAt: 'DESC' },
    });
  }

  async recordStockMovement(
    tenantId: string,
    dto: StockMovementRequest,
  ): Promise<StockMovement> {
    const product = await this.productRepository.findOne({
      where: { id: dto.productId, tenantId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    // Transactional update — stock level and movement log are consistent.
    return this.dataSource.transaction(async (manager) => {
      const movementRepo = manager.getRepository(StockMovement);
      const saved = movementRepo.create({
        ...dto,
        tenantId,
        unitCostAtTime: product.unitCost,
      });
      const stored = await movementRepo.save(saved);
      await this.applyMovementToLevels(manager, tenantId, dto);
      this.metrics.increment('smarterp_inventory_movements_total', {
        type: dto.movementType,
      });
      return stored;
    });
  }

  async getStockMovements(
    tenantId: string,
    productId?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResult<StockMovement>> {
    const where: FindOptionsWhere<StockMovement> = { tenantId };
    if (productId) where.productId = productId;
    const [data, total] = await this.stockMovementRepository.findAndCount({
      where,
      relations: ['product'],
      order: { createdAt: 'DESC' },
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

  async getLowStockProducts(tenantId: string): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.stockLevels', 'sl')
      .where('product.tenantId = :tenantId', { tenantId })
      .andWhere('product.isActive = true')
      .andWhere(
        '(SELECT COALESCE(SUM(sl2."quantityOnHand"), 0) FROM stock_levels sl2 WHERE sl2."productId" = product.id) <= product."reorderPoint"',
      )
      .getMany();
  }

  async getInventoryValuation(tenantId: string) {
    const stockLevels = await this.stockLevelRepository.find({
      where: { tenantId },
      relations: ['product', 'warehouse'],
    });
    let totalValue = 0;
    const byCategory: Record<string, number> = {};
    const byWarehouse: Record<string, number> = {};
    for (const sl of stockLevels) {
      const value = Number(sl.quantityOnHand) * Number(sl.product?.unitCost || 0);
      totalValue += value;
      if (sl.product?.category) {
        byCategory[sl.product.category] = (byCategory[sl.product.category] || 0) + value;
      }
      if (sl.warehouse?.name) {
        byWarehouse[sl.warehouse.name] = (byWarehouse[sl.warehouse.name] || 0) + value;
      }
    }
    return {
      totalValue: Number(totalValue.toFixed(2)),
      byCategory,
      byWarehouse,
    };
  }

  // ─── Reservations (used by sales confirm) ──────────────────────

  /**
   * Reserve stock for a sales order. Increments `quantityReserved` and emits
   * a RESERVATION movement audit record. Throws when available (on-hand -
   * reserved) is insufficient.
   */
  async reserveStock(
    tenantId: string,
    requests: ReservationRequest[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const slRepo = manager.getRepository(StockLevel);
      const mvRepo = manager.getRepository(StockMovement);
      for (const r of requests) {
        const stock = await slRepo.findOne({
          where: {
            tenantId,
            productId: r.productId,
            warehouseId: r.warehouseId,
          },
        });
        const onHand = Number(stock?.quantityOnHand ?? 0);
        const reserved = Number(stock?.quantityReserved ?? 0);
        const available = onHand - reserved;
        if (available < r.quantity) {
          throw new BadRequestException(
            `Insufficient available stock for product ${r.productId}: requested ${r.quantity}, available ${available}`,
          );
        }
        const target =
          stock ??
          slRepo.create({
            tenantId,
            productId: r.productId,
            warehouseId: r.warehouseId,
            quantityOnHand: 0,
            quantityReserved: 0,
            quantityOnOrder: 0,
          });
        target.quantityReserved = Number(target.quantityReserved ?? 0) + r.quantity;
        await slRepo.save(target);
        await mvRepo.save(
          mvRepo.create({
            tenantId,
            productId: r.productId,
            movementType: StockMovementType.ADJUSTMENT,
            quantity: r.quantity,
            destinationWarehouseId: r.warehouseId,
            referenceNumber: r.reference,
            notes: `Reservation for ${r.reference}`,
          }),
        );
      }
    });
  }

  /**
   * Release a reservation (sales order cancel). Decrements `quantityReserved`.
   * Never goes below zero; any excess release is clamped and logged.
   */
  async releaseReservation(
    tenantId: string,
    requests: ReservationRequest[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const slRepo = manager.getRepository(StockLevel);
      const mvRepo = manager.getRepository(StockMovement);
      for (const r of requests) {
        const stock = await slRepo.findOne({
          where: {
            tenantId,
            productId: r.productId,
            warehouseId: r.warehouseId,
          },
        });
        if (!stock) continue;
        const prior = Number(stock.quantityReserved ?? 0);
        const next = Math.max(0, prior - r.quantity);
        stock.quantityReserved = next;
        await slRepo.save(stock);
        await mvRepo.save(
          mvRepo.create({
            tenantId,
            productId: r.productId,
            movementType: StockMovementType.ADJUSTMENT,
            quantity: r.quantity,
            destinationWarehouseId: r.warehouseId,
            referenceNumber: r.reference,
            notes: `Reservation release for ${r.reference}`,
          }),
        );
      }
    });
  }

  /**
   * Ship a reservation (decrement both on-hand AND reserved). Used when
   * converting a confirmed sales order into a DDT/shipment.
   */
  async shipReservation(
    tenantId: string,
    requests: ReservationRequest[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const slRepo = manager.getRepository(StockLevel);
      const mvRepo = manager.getRepository(StockMovement);
      for (const r of requests) {
        const stock = await slRepo.findOne({
          where: {
            tenantId,
            productId: r.productId,
            warehouseId: r.warehouseId,
          },
        });
        if (!stock) {
          throw new BadRequestException(
            `Cannot ship: no stock record for product ${r.productId} in warehouse ${r.warehouseId}`,
          );
        }
        const onHand = Number(stock.quantityOnHand ?? 0);
        if (onHand < r.quantity) {
          throw new BadRequestException(
            `Insufficient on-hand stock to ship: on-hand ${onHand}, requested ${r.quantity}`,
          );
        }
        stock.quantityOnHand = onHand - r.quantity;
        stock.quantityReserved = Math.max(
          0,
          Number(stock.quantityReserved ?? 0) - r.quantity,
        );
        await slRepo.save(stock);
        await mvRepo.save(
          mvRepo.create({
            tenantId,
            productId: r.productId,
            movementType: StockMovementType.OUTBOUND,
            quantity: r.quantity,
            sourceWarehouseId: r.warehouseId,
            referenceNumber: r.reference,
            notes: `Shipment for ${r.reference}`,
          }),
        );
        this.metrics.increment('smarterp_inventory_movements_total', {
          type: 'outbound',
        });
      }
    });
  }

  /**
   * Expand a BOM and consume raw materials when a production order starts.
   * Each BOM line decrements on-hand stock in the default warehouse (first
   * active warehouse for the tenant if none specified).
   */
  async consumeBomForProductionOrder(
    tenantId: string,
    opts: {
      reference: string;
      bom: { materialId: string; quantityRequired: number; warehouseId?: string }[];
      fallbackWarehouseId?: string;
    },
  ): Promise<void> {
    const defaultWarehouseId =
      opts.fallbackWarehouseId ??
      (await this.warehouseRepository.findOne({
        where: { tenantId, isActive: true },
        order: { code: 'ASC' },
      }))?.id;

    if (!defaultWarehouseId) {
      throw new BadRequestException(
        'Cannot expand BOM: no warehouse available for tenant',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const slRepo = manager.getRepository(StockLevel);
      const mvRepo = manager.getRepository(StockMovement);
      for (const line of opts.bom) {
        const warehouseId = line.warehouseId ?? defaultWarehouseId;
        const stock = await slRepo.findOne({
          where: {
            tenantId,
            productId: line.materialId,
            warehouseId,
          },
        });
        const onHand = Number(stock?.quantityOnHand ?? 0);
        if (onHand < line.quantityRequired) {
          throw new BadRequestException(
            `BOM expansion failed: material ${line.materialId} short by ${line.quantityRequired - onHand}`,
          );
        }
        stock!.quantityOnHand = onHand - line.quantityRequired;
        await slRepo.save(stock!);
        await mvRepo.save(
          mvRepo.create({
            tenantId,
            productId: line.materialId,
            movementType: StockMovementType.PRODUCTION_CONSUMPTION,
            quantity: line.quantityRequired,
            sourceWarehouseId: warehouseId,
            referenceNumber: opts.reference,
            notes: `BOM consumption for ${opts.reference}`,
          }),
        );
        this.metrics.increment('smarterp_inventory_movements_total', {
          type: 'production_consumption',
        });
      }
    });
  }

  // ─── Private helpers ───────────────────────────────────────────

  private async applyMovementToLevels(
    manager: Parameters<Parameters<DataSource['transaction']>[0]>[0],
    tenantId: string,
    dto: StockMovementRequest,
  ): Promise<void> {
    const { movementType, productId, quantity, sourceWarehouseId, destinationWarehouseId } = dto;
    switch (movementType) {
      case StockMovementType.INBOUND:
      case StockMovementType.PRODUCTION_OUTPUT:
      case StockMovementType.RETURN:
        if (destinationWarehouseId) {
          await this.adjustStock(manager, tenantId, productId, destinationWarehouseId, quantity);
        }
        break;
      case StockMovementType.OUTBOUND:
      case StockMovementType.PRODUCTION_CONSUMPTION:
      case StockMovementType.SCRAP:
        if (sourceWarehouseId) {
          await this.adjustStock(manager, tenantId, productId, sourceWarehouseId, -quantity);
        }
        break;
      case StockMovementType.TRANSFER:
        if (sourceWarehouseId && destinationWarehouseId) {
          await this.adjustStock(manager, tenantId, productId, sourceWarehouseId, -quantity);
          await this.adjustStock(manager, tenantId, productId, destinationWarehouseId, quantity);
        }
        break;
      case StockMovementType.ADJUSTMENT:
        if (destinationWarehouseId) {
          await this.adjustStock(manager, tenantId, productId, destinationWarehouseId, quantity);
        }
        break;
    }
  }

  private async adjustStock(
    manager: Parameters<Parameters<DataSource['transaction']>[0]>[0],
    tenantId: string,
    productId: string,
    warehouseId: string,
    quantityDelta: number,
  ): Promise<void> {
    const slRepo = manager.getRepository(StockLevel);
    let stockLevel = await slRepo.findOne({
      where: { tenantId, productId, warehouseId },
    });
    if (!stockLevel) {
      stockLevel = slRepo.create({
        tenantId,
        productId,
        warehouseId,
        quantityOnHand: 0,
        quantityReserved: 0,
        quantityOnOrder: 0,
      });
    }
    const next = Number(stockLevel.quantityOnHand) + quantityDelta;
    if (next < 0) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${Number(stockLevel.quantityOnHand)}, Requested: ${Math.abs(quantityDelta)}`,
      );
    }
    stockLevel.quantityOnHand = next;
    await slRepo.save(stockLevel);
  }

  private async invalidateProductCache(tenantId: string): Promise<void> {
    const store = this.cacheManager.store as { keys?: (pattern: string) => Promise<string[]> };
    const keys = await store?.keys?.(`products:${tenantId}:*`);
    if (keys) {
      for (const key of keys) {
        await this.cacheManager.del(key);
      }
    }
  }
}
