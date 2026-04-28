import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  PurchaseRequisition,
  PurchaseRequisitionLine,
} from './entities/purchase-requisition.entity';
import {
  PurchaseOrder,
  PurchaseOrderLine,
} from './entities/purchase-order.entity';
import {
  RequestForQuote,
  RequestForQuoteLine,
  RequestForQuoteQuote,
} from './entities/request-for-quote.entity';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseRequisition,
      PurchaseRequisitionLine,
      PurchaseOrder,
      PurchaseOrderLine,
      RequestForQuote,
      RequestForQuoteLine,
      RequestForQuoteQuote,
    ]),
  ],
  providers: [ProcurementService],
  controllers: [ProcurementController],
  exports: [ProcurementService],
})
export class ProcurementModule {}
