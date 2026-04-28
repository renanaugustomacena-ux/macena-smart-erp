import { Module } from '@nestjs/common';
import { ShopifyConnector } from './connectors/shopify.connector';
import { ConnectorRegistry } from './connector-registry.service';
import { IntegrationsController } from './integrations.controller';

const CONNECTORS = [ShopifyConnector];

@Module({
  controllers: [IntegrationsController],
  providers: [
    ...CONNECTORS,
    {
      provide: ConnectorRegistry,
      inject: CONNECTORS,
      useFactory: (...connectors: unknown[]) =>
        new ConnectorRegistry(connectors as never),
    },
  ],
  exports: [ConnectorRegistry],
})
export class IntegrationsModule {}
