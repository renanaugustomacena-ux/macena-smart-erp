import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Projection,
  ProjectionContext,
  ProjectionRunResult,
} from '../projection.contract';
import { StockLevel } from '../../inventory/inventory.entity';

/**
 * inventory_stock_snapshot — current stock level + value per
 * (warehouseId, productId).
 * Key = `<warehouseId>:<productId>`. Payload = { quantity, lastMovedAt }.
 */
@Injectable()
export class InventoryStockSnapshotProjection implements Projection {
  readonly id = 'inventory_stock_snapshot';
  readonly description =
    'Per-(warehouse, product) stock level snapshot.';
  readonly source = 'inventory' as const;

  constructor(
    @InjectRepository(StockLevel)
    private readonly stockRepo: Repository<StockLevel>,
    private readonly dataSource: DataSource,
  ) {
    void this.dataSource;
  }

  async run(ctx: ProjectionContext): Promise<ProjectionRunResult> {
    const rows = await this.stockRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId: ctx.tenantId })
      .getMany();
    return {
      rows: rows.map((r) => ({
        key: `${r.warehouseId}:${r.productId}`,
        payload: {
          quantity: Number(r.quantity ?? 0),
          warehouseId: r.warehouseId,
          productId: r.productId,
        },
      })),
    };
  }
}
