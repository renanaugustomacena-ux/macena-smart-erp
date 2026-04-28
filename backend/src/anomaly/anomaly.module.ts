import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnomalyService } from './anomaly.service';
import { ComplianceReasonerService } from './compliance-reasoner.service';
import { AnomalyController } from './anomaly.controller';
import { ReadModelRow } from '../bi/entities/read-model-row.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ReadModelRow])],
  controllers: [AnomalyController],
  providers: [AnomalyService, ComplianceReasonerService],
  exports: [AnomalyService, ComplianceReasonerService],
})
export class AnomalyModule {}
