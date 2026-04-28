import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BankAccount,
  BankTransaction,
} from './entities/bank-account.entity';
import { TreasuryService } from './treasury.service';
import { TreasuryController } from './treasury.controller';
import { IntesaPsd2Adapter } from './psd2/intesa.adapter';
import { UnicreditPsd2Adapter } from './psd2/unicredit.adapter';
import { BperPsd2Adapter } from './psd2/bper.adapter';
import { CashForecastService } from './cash-forecast.service';
import { AutoReconcilerService } from './auto-reconciler.service';
import { CashForecastController } from './cash-forecast.controller';
import { Invoice } from '../accounting/accounting.entity';
import { SupplierInvoice } from '../procurement/entities/supplier-invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BankAccount,
      BankTransaction,
      Invoice,
      SupplierInvoice,
    ]),
  ],
  controllers: [TreasuryController, CashForecastController],
  providers: [
    TreasuryService,
    IntesaPsd2Adapter,
    UnicreditPsd2Adapter,
    BperPsd2Adapter,
    CashForecastService,
    AutoReconcilerService,
  ],
  exports: [
    TreasuryService,
    IntesaPsd2Adapter,
    UnicreditPsd2Adapter,
    BperPsd2Adapter,
    CashForecastService,
    AutoReconcilerService,
  ],
})
export class TreasuryModule {}
