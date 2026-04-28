import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { Customer, SalesOrder } from './sales.entity';
import { Warehouse } from '../inventory/inventory.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { MetricsModule } from '../metrics/metrics.module';
import {
  Quotation,
  QuotationLine,
} from './entities/quotation.entity';
import { Ddt, DdtLine } from './entities/ddt.entity';
import { ContactActivity } from './entities/contact-activity.entity';
import { SalesDepthService } from './sales-depth.service';
import { SalesDepthController } from './sales-depth.controller';
import { SalesPipelineService } from './sales-pipeline.service';
import { SalesPipelineController } from './sales-pipeline.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      SalesOrder,
      Warehouse,
      Quotation,
      QuotationLine,
      Ddt,
      DdtLine,
      ContactActivity,
    ]),
    InventoryModule,
    MetricsModule,
  ],
  controllers: [
    SalesController,
    SalesDepthController,
    SalesPipelineController,
  ],
  providers: [SalesService, SalesDepthService, SalesPipelineService],
  exports: [SalesService, SalesDepthService, SalesPipelineService],
})
export class SalesModule {}
