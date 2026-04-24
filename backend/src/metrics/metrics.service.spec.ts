import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;
  beforeEach(() => {
    service = new MetricsService();
  });

  it('renders build info with service version and node', () => {
    const out = service.render();
    expect(out).toMatch(/smarterp_build_info\{[^}]+\}\s+1/);
    expect(out).toContain('node=');
  });

  it('renders uptime and memory gauges', () => {
    const out = service.render();
    expect(out).toContain('smarterp_uptime_seconds ');
    expect(out).toContain('smarterp_memory_bytes{area="rss"}');
  });

  it('counts increments across registered counters', () => {
    service.increment('smarterp_inventory_movements_total', { type: 'inbound' }, 5);
    service.increment('smarterp_inventory_movements_total', { type: 'inbound' }, 2);
    const out = service.render();
    expect(out).toContain('smarterp_inventory_movements_total{type="inbound"} 7');
  });

  it('reports 0 for counters without any increment', () => {
    const out = service.render();
    expect(out).toContain('smarterp_sales_orders_total 0');
  });

  it('ignores unknown counter names without throwing', () => {
    expect(() => service.increment('no_such_counter', {}, 1)).not.toThrow();
  });
});
