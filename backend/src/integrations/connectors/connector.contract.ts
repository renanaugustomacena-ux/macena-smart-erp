/**
 * Connector contract — every external-system connector implements this
 * interface (plan §31.1 Sprint 21 / S21.3).
 *
 * Connectors are the OUTBOUND side of the integration hub: they pull
 * from / push to a third-party system on behalf of a tenant. Every
 * connector ships with:
 *   - a per-tenant configuration store under
 *     `tenant.settings.integrations.<connector_id>`,
 *   - a sandbox mode that returns deterministic synthetic responses
 *     for end-to-end testing,
 *   - a healthcheck() that returns the upstream's reachability + the
 *     last successful sync timestamp.
 */

export type ConnectorMode = 'sandbox' | 'production';

export interface ConnectorContext {
  tenantId: string;
  mode: ConnectorMode;
  /** Per-tenant credentials (decrypted by the registry; opaque here). */
  credentials: Record<string, string>;
}

export interface ConnectorHealthResult {
  ok: boolean;
  mode: ConnectorMode;
  upstreamReachable: boolean;
  lastSuccessfulSync: string | null;
  message?: string;
}

export interface ConnectorSyncResult {
  itemsImported: number;
  itemsSkipped: number;
  cursorAt: string;
  warnings: string[];
}

export interface Connector {
  readonly id: string;
  readonly description: string;
  readonly source: string;
  healthcheck(ctx: ConnectorContext): Promise<ConnectorHealthResult>;
  syncIncoming(ctx: ConnectorContext): Promise<ConnectorSyncResult>;
}
