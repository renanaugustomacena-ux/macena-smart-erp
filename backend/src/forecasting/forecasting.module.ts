import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForecastingService } from './forecasting.service';
import { ForecastingController } from './forecasting.controller';
import { Product, StockLevel } from '../inventory/inventory.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Product, StockLevel])],
  controllers: [ForecastingController],
  providers: [ForecastingService],
  exports: [ForecastingService],
})
export class ForecastingModule {}
