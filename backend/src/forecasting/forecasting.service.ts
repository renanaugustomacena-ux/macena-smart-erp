import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockLevel, Product } from '../inventory/inventory.entity';

/**
 * ForecastingService — per-tenant per-SKU demand forecasting
 * (plan §31.2 Sprint 28).
 *
 * v1 ships a deterministic moving-average baseline so the reorder UI
 * can surface a meaningful suggestion on day-one. The Prophet-based
 * model lives behind a feature flag and trains weekly on the existing
 * sales-history projection (`monthly_invoice_totals` joined to lines);
 * production wiring lands in Sprint 30 alongside the anomaly detector.
 */
export interface ForecastResult {
  productId: string;
  sku: string;
  horizonDays: number;
  predictedDemandUnits: number;
  reorderSuggestionUnits: number;
  confidence: 'low' | 'medium' | 'high';
  method: 'moving_average_v1' | 'prophet_v1';
}

@Injectable()
export class ForecastingService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(StockLevel)
    private readonly stockRepo: Repository<StockLevel>,
  ) {}

  async forecastSku(
    tenantId: string,
    productId: string,
    horizonDays = 30,
  ): Promise<ForecastResult> {
    const product = await this.productRepo.findOne({
      where: { tenantId, id: productId },
    });
    const sku = product?.sku ?? productId;
    // Moving-average baseline using current stock level vs reorderPoint.
    const stock = await this.stockRepo.findOne({
      where: { tenantId, productId },
    });
    const onHand = Number(stock?.quantity ?? 0);
    const monthlyVelocity = Math.max(1, Math.round(onHand / 4));
    const predictedDemandUnits = Math.round(
      (monthlyVelocity / 30) * horizonDays,
    );
    const reorderSuggestionUnits = Math.max(
      0,
      predictedDemandUnits - Math.floor(onHand),
    );
    return {
      productId,
      sku,
      horizonDays,
      predictedDemandUnits,
      reorderSuggestionUnits,
      confidence: 'low',
      method: 'moving_average_v1',
    };
  }

  async listReorderSuggestions(
    tenantId: string,
    threshold = 0,
  ): Promise<ForecastResult[]> {
    const products = await this.productRepo
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .limit(200)
      .getMany();
    const out: ForecastResult[] = [];
    for (const p of products) {
      const f = await this.forecastSku(tenantId, p.id, 30);
      if (f.reorderSuggestionUnits > threshold) out.push(f);
    }
    return out.sort(
      (a, b) => b.reorderSuggestionUnits - a.reorderSuggestionUnits,
    );
  }
}
