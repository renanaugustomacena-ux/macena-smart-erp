import { Module } from '@nestjs/common';
import { ArubaConservazioneAdapter } from './aruba.adapter';
import { InfoCertConservazioneAdapter } from './infocert.adapter';
import { ConservazioneRegistry } from './conservazione-registry.service';

/**
 * ConservazioneModule — per ADR-016.
 *
 * Wires the per-vendor Conservatore adapters and exposes a registry that
 * other modules (Accounting, Procurement) consume to archive FatturaPA
 * documents.
 */
@Module({
  providers: [
    ArubaConservazioneAdapter,
    InfoCertConservazioneAdapter,
    ConservazioneRegistry,
  ],
  exports: [ConservazioneRegistry],
})
export class ConservazioneModule {}
