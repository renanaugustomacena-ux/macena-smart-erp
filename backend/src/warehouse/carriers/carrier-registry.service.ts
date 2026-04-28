import { Injectable, NotFoundException } from '@nestjs/common';
import { CarrierAdapter, CarrierId } from './carrier.adapter';
import { BartoliniAdapter } from './bartolini.adapter';

/**
 * CarrierRegistry — per ADR-019.
 *
 * Maps a carrierId to a registered CarrierAdapter at composition time.
 * Adding a new carrier is a one-file change: implement
 * `<vendor>.adapter.ts`, add a constructor injection here, and append to
 * the internal Map. Other modules query through `get()` only.
 */
@Injectable()
export class CarrierRegistry {
  private readonly adapters: Map<CarrierId, CarrierAdapter>;

  constructor(private readonly bartolini: BartoliniAdapter) {
    this.adapters = new Map<CarrierId, CarrierAdapter>([
      [bartolini.carrierId, bartolini],
      // Sprint 19 wires GLS here.
      // Sprint 21 wires BRT, SDA.
      // Enterprise demand wires DHL.
    ]);
  }

  get(carrierId: CarrierId): CarrierAdapter {
    const adapter = this.adapters.get(carrierId);
    if (!adapter) {
      throw new NotFoundException(`No adapter registered for carrier '${carrierId}'`);
    }
    return adapter;
  }

  list(): CarrierId[] {
    return Array.from(this.adapters.keys());
  }
}
