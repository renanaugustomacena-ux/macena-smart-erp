import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { Customer, SalesOrder } from './sales.entity';
import { Warehouse } from '../inventory/inventory.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, SalesOrder, Warehouse]),
    InventoryModule,
    MetricsModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
