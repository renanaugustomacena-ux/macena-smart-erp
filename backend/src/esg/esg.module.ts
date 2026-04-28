import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { EsgService } from './esg.service';
import { EsgController } from './esg.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  controllers: [EsgController],
  providers: [EsgService],
  exports: [EsgService],
})
export class EsgModule {}
