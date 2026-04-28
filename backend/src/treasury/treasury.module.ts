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

@Module({
  imports: [TypeOrmModule.forFeature([BankAccount, BankTransaction])],
  controllers: [TreasuryController],
  providers: [
    TreasuryService,
    IntesaPsd2Adapter,
    UnicreditPsd2Adapter,
    BperPsd2Adapter,
  ],
  exports: [
    TreasuryService,
    IntesaPsd2Adapter,
    UnicreditPsd2Adapter,
    BperPsd2Adapter,
  ],
})
export class TreasuryModule {}
