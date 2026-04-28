import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { MultiCompanyService } from './multi-company.service';
import { MultiCompanyController } from './multi-company.controller';
import { ConsolidationService } from './consolidation.service';
import { ConsolidationController } from './consolidation.controller';
import { Invoice } from '../accounting/accounting.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Company, Invoice, SupplierInvoice])],
  controllers: [MultiCompanyController, ConsolidationController],
  providers: [MultiCompanyService, ConsolidationService],
  exports: [MultiCompanyService, ConsolidationService],
})
export class MultiCompanyModule {}
