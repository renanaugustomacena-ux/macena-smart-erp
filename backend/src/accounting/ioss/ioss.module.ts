import { Module } from '@nestjs/common';
import { IossService } from './ioss.service';

@Module({
  providers: [IossService],
  exports: [IossService],
})
export class IossModule {}
