import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ConservazioneAdapter,
  ConservazioneVendorId,
} from './conservazione.adapter';
import { ArubaConservazioneAdapter } from './aruba.adapter';
import { InfoCertConservazioneAdapter } from './infocert.adapter';

/**
 * ConservazioneRegistry — per ADR-016.
 *
 * Maps a `ConservazioneVendorId` to a registered `ConservazioneAdapter`
 * at composition time. Adding a new Conservatore is a one-file change:
 * implement `<vendor>.adapter.ts`, add a constructor injection here, and
 * append to the internal Map. Other modules query through `get()` only.
 *
 * Per-tenant default lives in `tenant.settings.conservazione.default`;
 * per-document override is allowed (rare; usually constant per fiscal
 * year per DPCM 3/12/2013 §6 stability requirement).
 */
@Injectable()
export class ConservazioneRegistry {
  private readonly adapters: Map<ConservazioneVendorId, ConservazioneAdapter>;

  constructor(
    private readonly aruba: ArubaConservazioneAdapter,
    private readonly infocert: InfoCertConservazioneAdapter,
  ) {
    this.adapters = new Map<ConservazioneVendorId, ConservazioneAdapter>([
      [aruba.vendorId, aruba],
      [infocert.vendorId, infocert],
      // Enterprise demand wires Namirial here (third Conservatore).
    ]);
  }

  get(vendorId: ConservazioneVendorId): ConservazioneAdapter {
    const adapter = this.adapters.get(vendorId);
    if (!adapter) {
      throw new NotFoundException(
        `No Conservazione adapter registered for vendorId '${vendorId}'`,
      );
    }
    return adapter;
  }

  list(): ConservazioneVendorId[] {
    return Array.from(this.adapters.keys());
  }
}
