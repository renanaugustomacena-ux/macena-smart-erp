import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membership } from '../memberships/membership.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Invoice } from '../accounting/accounting.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';
import { IntrastatDeclaration } from '../intrastat/entities/intrastat-declaration.entity';
import { Quotation } from '../sales/entities/quotation.entity';
import { CommercialistaService } from './commercialista.service';
import { CommercialistaController } from './commercialista.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Membership,
      Tenant,
      Invoice,
      SupplierInvoice,
      IntrastatDeclaration,
      Quotation,
    ]),
  ],
  controllers: [CommercialistaController],
  providers: [CommercialistaService],
  exports: [CommercialistaService],
})
export class CommercialistaModule {}
