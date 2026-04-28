import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ProjectionCursor,
  ReadModelRow,
} from './entities/read-model-row.entity';
import {
  ReportDefinition,
  ReportSchedule,
} from './entities/report-definition.entity';
import { Invoice } from '../accounting/accounting.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';
import { Quotation } from '../sales/entities/quotation.entity';
import { Ddt } from '../sales/entities/ddt.entity';
import { Attendance } from '../hr/entities/attendance.entity';
import { LeaveRequest } from '../hr/entities/leave-request.entity';
import { IntrastatDeclaration } from '../intrastat/entities/intrastat-declaration.entity';
import { StockLevel } from '../inventory/inventory.entity';
import { ProjectionRegistry } from './projection-registry.service';
import { ProjectionOrchestrator } from './projection.orchestrator';
import { MonthlyInvoiceTotalsProjection } from './projections/monthly-invoice-totals.projection';
import { MonthlySupplierInvoiceTotalsProjection } from './projections/monthly-supplier-invoice-totals.projection';
import { CustomerRevenueRankingProjection } from './projections/customer-revenue-ranking.projection';
import { SupplierSpendRankingProjection } from './projections/supplier-spend-ranking.projection';
import { QuotationPipelineSummaryProjection } from './projections/quotation-pipeline-summary.projection';
import { DdtThroughputProjection } from './projections/ddt-throughput.projection';
import { IvaPeriodicBalanceProjection } from './projections/iva-periodic-balance.projection';
import { EmployeeAttendanceSummaryProjection } from './projections/employee-attendance-summary.projection';
import { LeaveBalanceSummaryProjection } from './projections/leave-balance-summary.projection';
import { IntrastatMonthlySummaryProjection } from './projections/intrastat-monthly-summary.projection';
import { InventoryStockSnapshotProjection } from './projections/inventory-stock-snapshot.projection';
import { ReportService } from './report.service';
import { ReportExporterService } from './report-exporter.service';
import { BiController } from './bi.controller';

const PROJECTION_PROVIDERS = [
  MonthlyInvoiceTotalsProjection,
  MonthlySupplierInvoiceTotalsProjection,
  CustomerRevenueRankingProjection,
  SupplierSpendRankingProjection,
  QuotationPipelineSummaryProjection,
  DdtThroughputProjection,
  IvaPeriodicBalanceProjection,
  EmployeeAttendanceSummaryProjection,
  LeaveBalanceSummaryProjection,
  IntrastatMonthlySummaryProjection,
  InventoryStockSnapshotProjection,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReadModelRow,
      ProjectionCursor,
      ReportDefinition,
      ReportSchedule,
      Invoice,
      SupplierInvoice,
      Quotation,
      Ddt,
      Attendance,
      LeaveRequest,
      IntrastatDeclaration,
      StockLevel,
    ]),
  ],
  controllers: [BiController],
  providers: [
    ...PROJECTION_PROVIDERS,
    {
      provide: ProjectionRegistry,
      inject: PROJECTION_PROVIDERS,
      useFactory: (...projections: unknown[]) =>
        new ProjectionRegistry(projections as never),
    },
    ProjectionOrchestrator,
    ReportService,
    ReportExporterService,
  ],
  exports: [
    ProjectionRegistry,
    ProjectionOrchestrator,
    ReportService,
    ReportExporterService,
  ],
})
export class BiModule {}
