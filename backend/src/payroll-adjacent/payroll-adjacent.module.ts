import { Module } from '@nestjs/common';
import { PayrollAdjacentController } from './payroll-adjacent.controller';

@Module({
  controllers: [PayrollAdjacentController],
})
export class PayrollAdjacentModule {}
