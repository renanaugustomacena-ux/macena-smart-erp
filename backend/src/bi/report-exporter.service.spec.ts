import { ReportExporterService } from './report-exporter.service';
import {
  DASHBOARD_CATALOG,
  DashboardManifest,
} from './dashboards/dashboards.catalog';
import { ReadModelRow } from './entities/read-model-row.entity';

describe('ReportExporterService (S18.5)', () => {
  const svc = new ReportExporterService();
  const dashboard: DashboardManifest = DASHBOARD_CATALOG.find(
    (d) => d.id === 'marco/revenue_overview',
  )!;
  const widgetRows: ReadModelRow[] = [
    {
      id: 'r1',
      tenantId: 't',
      projectionId: 'monthly_invoice_totals',
      key: '2026-04',
      payload: { totalCents: 250_000, count: 5 },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as ReadModelRow,
    {
      id: 'r2',
      tenantId: 't',
      projectionId: 'monthly_invoice_totals',
      key: '2026-05',
      payload: { totalCents: 300_000, count: 7 },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as ReadModelRow,
  ];
  const widgets = [
    {
      widgetId: 'rev_monthly',
      projectionId: 'monthly_invoice_totals',
      rows: widgetRows,
    },
  ];

  it('exports CSV with header + per-widget rows', () => {
    const out = svc.export({ dashboard, widgets, format: 'csv' });
    expect(out.contentType).toContain('text/csv');
    const body = out.body.toString('utf8');
    expect(body).toContain('Andamento fatturato');
    expect(body).toContain('2026-04');
    expect(body).toContain('250000');
  });

  it('exports XLSX (SpreadsheetML 2003 XML)', () => {
    const out = svc.export({ dashboard, widgets, format: 'xlsx' });
    expect(out.contentType).toContain('vnd.ms-excel');
    const body = out.body.toString('utf8');
    expect(body).toContain('<?xml');
    expect(body).toContain('Worksheet');
    expect(body).toContain('2026-04');
  });

  it('exports a self-contained PDF 1.4 stream', () => {
    const out = svc.export({ dashboard, widgets, format: 'pdf' });
    expect(out.contentType).toBe('application/pdf');
    const head = out.body.subarray(0, 8).toString('latin1');
    expect(head).toMatch(/^%PDF-1\.4/);
    const tail = out.body.subarray(-6).toString('latin1');
    expect(tail).toContain('%%EOF');
  });

  it('catalog covers 4 personas × 10 dashboards = 40 entries', () => {
    expect(DASHBOARD_CATALOG).toHaveLength(40);
    const personas = new Set(DASHBOARD_CATALOG.map((d) => d.persona));
    expect(personas).toEqual(new Set(['marco', 'sara', 'luca', 'giulia']));
    for (const p of personas) {
      expect(
        DASHBOARD_CATALOG.filter((d) => d.persona === p),
      ).toHaveLength(10);
    }
  });
});
