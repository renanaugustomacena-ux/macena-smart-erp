import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BankAccount,
  BankTransaction,
} from './entities/bank-account.entity';
import { TreasuryService } from './treasury.service';
import { TreasuryController } from './treasury.controller';
import { IntesaPsd2Adapter } from './psd2/intesa.adapter';

@Module({
  imports: [TypeOrmModule.forFeature([BankAccount, BankTransaction])],
  controllers: [TreasuryController],
  providers: [TreasuryService, IntesaPsd2Adapter],
  exports: [TreasuryService, IntesaPsd2Adapter],
})
export class TreasuryModule {}
