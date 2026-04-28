/**
 * Projection contract — every per-projection worker implements this
 * interface (plan §31.1 Sprint 18 / S18.2; ADR-010).
 *
 * Projections are pure: given a tenant + a time window, they read source
 * tables and produce { key, payload }[] rows. The orchestrator is
 * responsible for upserting them into the `read_model_rows` table and
 * advancing the cursor.
 */

export interface ProjectionRow {
  /** Natural key per projection (e.g., `2026-04`, `<productId>`). */
  key: string;
  /** Projected payload — projection-defined shape. */
  payload: Record<string, unknown>;
}

export interface ProjectionContext {
  tenantId: string;
  /** Inclusive lower bound (RFC 3339 UTC). null => from epoch. */
  fromTimestamp: Date | null;
  /** Exclusive upper bound (RFC 3339 UTC). null => up to "now". */
  toTimestamp: Date | null;
}

export interface ProjectionRunResult {
  rows: ProjectionRow[];
  /** Optional updated cursor anchor — defaults to ctx.toTimestamp. */
  cursorAt?: Date;
}

export interface Projection {
  readonly id: string;
  readonly description: string;
  /** Source-domain hint — informational only (audits, dashboards). */
  readonly source:
    | 'invoices'
    | 'supplier_invoices'
    | 'sales_orders'
    | 'inventory'
    | 'production'
    | 'attendances'
    | 'leave_requests'
    | 'audit'
    | 'mixed';
  run(ctx: ProjectionContext): Promise<ProjectionRunResult>;
}
