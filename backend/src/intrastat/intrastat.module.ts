import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  IntrastatDeclaration,
  IntrastatLine,
} from './entities/intrastat-declaration.entity';
import { Invoice } from '../accounting/accounting.entity';
import { Customer } from '../sales/sales.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';
import { IntrastatService } from './intrastat.service';
import { IntrastatController } from './intrastat.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntrastatDeclaration,
      IntrastatLine,
      Invoice,
      Customer,
      SupplierInvoice,
    ]),
  ],
  controllers: [IntrastatController],
  providers: [IntrastatService],
  exports: [IntrastatService],
})
export class IntrastatModule {}
