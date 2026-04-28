import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { MultiCompanyService } from './multi-company.service';
import { MultiCompanyController } from './multi-company.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company])],
  controllers: [MultiCompanyController],
  providers: [MultiCompanyService],
  exports: [MultiCompanyService],
})
export class MultiCompanyModule {}
