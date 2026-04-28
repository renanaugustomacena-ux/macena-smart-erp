import { Injectable, Logger } from '@nestjs/common';
import {
  Connector,
  ConnectorContext,
  ConnectorHealthResult,
  ConnectorSyncResult,
} from './connector.contract';

/**
 * ShopifyConnector — first marketplace connector (plan §31.1 Sprint 21 / S21.3).
 *
 * Pulls Shopify customers + products + orders into SmartERP via the
 * Admin REST API (`/admin/api/2024-04/orders.json`). Sandbox mode
 * returns deterministic synthetic responses so end-to-end tests do
 * not consume a real Shopify quota; the production path lands in
 * Sprint 24 alongside the BullMQ live worker.
 *
 * Per-tenant credentials live under
 * `tenant.settings.integrations.shopify.{shopDomain, accessToken,
 * webhookSecret}` (encrypted per ADR-DA07). The shop's `Webhook
 * Subscription` is created at first connect and consumed by the
 * webhook ingestor (S21.2).
 */
@Injectable()
export class ShopifyConnector implements Connector {
  readonly id = 'shopify';
  readonly description =
    'Shopify Admin REST connector — sync customers, products, orders.';
  readonly source = 'shopify';

  private readonly logger = new Logger(ShopifyConnector.name);

  async healthcheck(ctx: ConnectorContext): Promise<ConnectorHealthResult> {
    if (ctx.mode === 'sandbox') {
      return {
        ok: true,
        mode: 'sandbox',
        upstreamReachable: true,
        lastSuccessfulSync: null,
        message: 'sandbox',
      };
    }
    if (!ctx.credentials.shopDomain || !ctx.credentials.accessToken) {
      return {
        ok: false,
        mode: 'production',
        upstreamReachable: false,
        lastSuccessfulSync: null,
        message:
          'Missing credentials: configure tenant.settings.integrations.shopify',
      };
    }
    // Production HTTP probe lives in S24; here we keep the contract
    // shape and return a not-yet-wired marker so the operator UI can
    // surface it.
    return {
      ok: false,
      mode: 'production',
      upstreamReachable: false,
      lastSuccessfulSync: null,
      message: 'Production wiring lands in Sprint 24 (BullMQ live worker)',
    };
  }

  async syncIncoming(
    ctx: ConnectorContext,
  ): Promise<ConnectorSyncResult> {
    if (ctx.mode === 'sandbox') {
      // Deterministic synthetic response — keeps the orchestrator
      // exercisable.
      this.logger.log({
        event: 'shopify.sync.sandbox',
        tenantId: ctx.tenantId,
      });
      return {
        itemsImported: 0,
        itemsSkipped: 0,
        cursorAt: new Date().toISOString(),
        warnings: ['sandbox mode — no real Shopify call performed'],
      };
    }
    return {
      itemsImported: 0,
      itemsSkipped: 0,
      cursorAt: new Date().toISOString(),
      warnings: [
        'Production sync deferred to Sprint 24 alongside the BullMQ worker',
      ],
    };
  }
}
