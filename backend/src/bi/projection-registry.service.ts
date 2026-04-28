import { Injectable, NotFoundException } from '@nestjs/common';
import { Projection } from './projection.contract';

/**
 * ProjectionRegistry — central catalogue of every CQRS projection
 * (plan §31.1 Sprint 18 / S18.2; ADR-010).
 *
 * The registry receives Projection providers via constructor injection
 * (Nest DI marshals them through the multi-provider pattern). Adding a
 * new projection is a one-file change: implement the contract, list it
 * in `BiModule.providers`, and append to the registry.
 */
@Injectable()
export class ProjectionRegistry {
  private readonly map = new Map<string, Projection>();

  constructor(projections: Projection[]) {
    for (const p of projections) {
      if (this.map.has(p.id)) {
        throw new Error(`Duplicate projectionId '${p.id}'`);
      }
      this.map.set(p.id, p);
    }
  }

  get(id: string): Projection {
    const p = this.map.get(id);
    if (!p) throw new NotFoundException(`Projection '${id}' not found`);
    return p;
  }

  list(): Projection[] {
    return Array.from(this.map.values()).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
  }

  has(id: string): boolean {
    return this.map.has(id);
  }
}
