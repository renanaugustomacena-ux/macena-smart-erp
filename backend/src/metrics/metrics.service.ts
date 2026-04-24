import { Injectable } from '@nestjs/common';

/**
 * MetricsService — minimal, zero-dependency Prometheus exposition.
 *
 * Intentionally does not pull `prom-client` so that the build stays lean
 * and the Docker image smaller; the endpoint must expose `service_build_info`
 * (gauge) and basic HTTP counters per plan gate G4. The abstraction is
 * structured so we can swap in `prom-client` later without changing the
 * controller contract.
 */

type CounterLabels = Record<string, string>;

interface CounterEntry {
  name: string;
  help: string;
  value: Map<string, number>;
}

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now();
  private readonly counters = new Map<string, CounterEntry>();

  constructor() {
    this.registerCounter(
      'smarterp_http_requests_total',
      'Total HTTP requests handled by the API, labelled by method, path, status',
    );
    this.registerCounter(
      'smarterp_http_errors_total',
      'Total HTTP error responses (status >= 400), labelled by method, path, status',
    );
    this.registerCounter(
      'smarterp_inventory_movements_total',
      'Total recorded stock movements, labelled by type',
    );
    this.registerCounter(
      'smarterp_sales_orders_total',
      'Total sales orders created',
    );
    this.registerCounter(
      'smarterp_invoices_total',
      'Total invoices created, labelled by documentType',
    );
    this.registerCounter(
      'smarterp_auth_events_total',
      'Authentication events, labelled by event and outcome',
    );
  }

  private registerCounter(name: string, help: string): CounterEntry {
    const entry: CounterEntry = { name, help, value: new Map() };
    this.counters.set(name, entry);
    return entry;
  }

  increment(name: string, labels: CounterLabels = {}, by: number = 1): void {
    const entry = this.counters.get(name);
    if (!entry) return;
    const key = this.labelKey(labels);
    entry.value.set(key, (entry.value.get(key) ?? 0) + by);
  }

  /** Build a Prometheus-text-format payload. */
  render(): string {
    const lines: string[] = [];

    // Build-info gauge
    lines.push('# HELP smarterp_build_info SmartERP backend build metadata');
    lines.push('# TYPE smarterp_build_info gauge');
    const version = process.env.APP_VERSION ?? '1.0.0';
    const buildSha = process.env.BUILD_SHA ?? 'dev';
    const nodeVersion = process.version;
    lines.push(
      `smarterp_build_info{version="${this.escape(version)}",build_sha="${this.escape(buildSha)}",node="${this.escape(nodeVersion)}"} 1`,
    );

    // Uptime
    const uptime = (Date.now() - this.startedAt) / 1000;
    lines.push('# HELP smarterp_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE smarterp_uptime_seconds gauge');
    lines.push(`smarterp_uptime_seconds ${uptime.toFixed(3)}`);

    // Process memory
    const mem = process.memoryUsage();
    lines.push('# HELP smarterp_memory_bytes Node.js process memory usage in bytes, by area');
    lines.push('# TYPE smarterp_memory_bytes gauge');
    for (const [area, value] of Object.entries(mem)) {
      lines.push(`smarterp_memory_bytes{area="${this.escape(area)}"} ${value}`);
    }

    // Counters
    for (const entry of this.counters.values()) {
      lines.push(`# HELP ${entry.name} ${entry.help}`);
      lines.push(`# TYPE ${entry.name} counter`);
      if (entry.value.size === 0) {
        lines.push(`${entry.name} 0`);
        continue;
      }
      for (const [labelKey, value] of entry.value) {
        const labels = labelKey ? `{${labelKey}}` : '';
        lines.push(`${entry.name}${labels} ${value}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  private labelKey(labels: CounterLabels): string {
    const keys = Object.keys(labels).sort();
    return keys.map((k) => `${k}="${this.escape(labels[k])}"`).join(',');
  }

  private escape(s: string): string {
    return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
}
