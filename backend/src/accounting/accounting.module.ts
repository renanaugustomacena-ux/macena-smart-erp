import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { ChartOfAccount, JournalEntry, Invoice } from './accounting.entity';
import { Customer, SalesOrder } from '../sales/sales.entity';
import { Tenant } from '../tenants/tenant.entity';
import { FatturaPaAdapter } from './fatturapa/fatturapa-adapter';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChartOfAccount,
      JournalEntry,
      Invoice,
      Customer,
      SalesOrder,
      Tenant,
    ]),
    MetricsModule,
  ],
  controllers: [AccountingController],
  providers: [AccountingService, FatturaPaAdapter],
  exports: [AccountingService, FatturaPaAdapter],
})
export class AccountingModule {}
