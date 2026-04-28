import { Injectable, NotFoundException } from '@nestjs/common';
import { Connector } from './connectors/connector.contract';

@Injectable()
export class ConnectorRegistry {
  private readonly map = new Map<string, Connector>();

  constructor(connectors: Connector[]) {
    for (const c of connectors) {
      if (this.map.has(c.id)) {
        throw new Error(`Duplicate connector id '${c.id}'`);
      }
      this.map.set(c.id, c);
    }
  }

  get(id: string): Connector {
    const c = this.map.get(id);
    if (!c) throw new NotFoundException(`Connector '${id}' not found`);
    return c;
  }

  list(): Connector[] {
    return Array.from(this.map.values());
  }
}
