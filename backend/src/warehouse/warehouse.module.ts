import { Module } from '@nestjs/common';
import { BartoliniAdapter } from './carriers/bartolini.adapter';
import { CarrierRegistry } from './carriers/carrier-registry.service';

/**
 * Warehouse + Logistics module (plan §9.10).
 *
 * Sprint 13 (S13.4): only the CarrierRegistry + Bartolini skeleton ship.
 * Sprint 19 wires the live Bartolini + GLS adapters and the
 * Putaway/PickList/Shipment aggregates.
 */
@Module({
  providers: [BartoliniAdapter, CarrierRegistry],
  exports: [CarrierRegistry],
})
export class WarehouseModule {}
