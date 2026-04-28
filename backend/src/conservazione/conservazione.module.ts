import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArubaConservazioneAdapter } from './aruba.adapter';
import { InfoCertConservazioneAdapter } from './infocert.adapter';
import { ConservazioneRegistry } from './conservazione-registry.service';
import { ConservazioneOrchestrator } from './conservazione.orchestrator';
import { Tenant } from '../tenants/tenant.entity';

/**
 * ConservazioneModule — per ADR-016 + ADR-025.
 *
 * Wires the per-vendor Conservatore adapters, the registry, and the
 * tier-aware orchestrator other modules (Accounting, Procurement) call
 * to archive FatturaPA documents. Direct registry use is reserved for
 * super-admin tools and the demo seeder.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [
    ArubaConservazioneAdapter,
    InfoCertConservazioneAdapter,
    ConservazioneRegistry,
    ConservazioneOrchestrator,
  ],
  exports: [ConservazioneRegistry, ConservazioneOrchestrator],
})
export class ConservazioneModule {}
