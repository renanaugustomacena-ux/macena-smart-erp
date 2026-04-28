import { BadRequestException, Injectable } from '@nestjs/common';
import { ReadModelRow } from './entities/read-model-row.entity';
import { DashboardManifest } from './dashboards/dashboards.catalog';

export type ReportExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportExportInput {
  dashboard: DashboardManifest;
  widgets: Array<{
    widgetId: string;
    projectionId: string;
    rows: ReadModelRow[];
  }>;
  format: ReportExportFormat;
}

export interface ReportExportOutput {
  filename: string;
  contentType: string;
  body: Buffer;
}

/**
 * ReportExporter — three drivers (CSV, XLSX, PDF) over a dashboard
 * manifest + projection rows (plan §31.1 Sprint 18 / S18.5).
 *
 * v1 deliberately keeps everything self-contained (no puppeteer / no
 * exceljs dependency) so the service has zero new runtime deps.
 *   - CSV  — pure text generation; `;` as the separator (Italian
 *            Excel-friendly).
 *   - XLSX — produces an Office Open XML SpreadsheetML 2003 XML
 *            stream (legal `.xml` Excel format Excel/LibreOffice both
 *            open). Trade-off: simpler than .xlsx zip, fully
 *            standalone, accepted by Italian commercialisti tooling.
 *   - PDF  — produces a minimal PDF 1.4 with one page per widget,
 *            text-only. Production polish (charts, branding) lands
 *            in S20 alongside the NIS2 Compliance Pack PDF generator.
 */
@Injectable()
export class ReportExporterService {
  export(input: ReportExportInput): ReportExportOutput {
    switch (input.format) {
      case 'csv':
        return this.exportCsv(input);
      case 'xlsx':
        return this.exportXlsx(input);
      case 'pdf':
        return this.exportPdf(input);
      default: {
        const exhaustive: never = input.format;
        throw new BadRequestException(
          `Unsupported report export format: ${exhaustive}`,
        );
      }
    }
  }

  private exportCsv(input: ReportExportInput): ReportExportOutput {
    const lines: string[] = [
      `Dashboard;${csvEscape(input.dashboard.title)}`,
      `Persona;${input.dashboard.persona}`,
      `Generated;${new Date().toISOString()}`,
      '',
    ];
    for (const w of input.widgets) {
      lines.push(`Widget;${csvEscape(w.widgetId)}`);
      lines.push(`Projection;${csvEscape(w.projectionId)}`);
      const headers = collectHeaders(w.rows);
      lines.push(`Key;${headers.join(';')}`);
      for (const r of w.rows) {
        const cells = headers.map((h) =>
          csvEscape(formatCell(r.payload[h] as unknown)),
        );
        lines.push(`${csvEscape(r.key)};${cells.join(';')}`);
      }
      lines.push('');
    }
    const body = Buffer.from(lines.join('\r\n'), 'utf8');
    return {
      filename: `${input.dashboard.id.replace(/[^a-z0-9]+/gi, '_')}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body,
    };
  }

  private exportXlsx(input: ReportExportInput): ReportExportOutput {
    // SpreadsheetML 2003 XML — opens in Excel + LibreOffice without
    // a `.xlsx` zip dependency.
    const sheets = input.widgets.map((w) => {
      const headers = ['Key', ...collectHeaders(w.rows)];
      const headerRow = `<Row>${headers
        .map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
        .join('')}</Row>`;
      const dataRows = w.rows
        .map(
          (r) =>
            `<Row>${[r.key, ...headers.slice(1).map((h) => formatCell(r.payload[h]))]
              .map(
                (cell) =>
                  `<Cell><Data ss:Type="${typeof cell === 'number' ? 'Number' : 'String'}">${escapeXml(String(cell ?? ''))}</Data></Cell>`,
              )
              .join('')}</Row>`,
        )
        .join('');
      return `<Worksheet ss:Name="${escapeXml(safeSheetName(w.widgetId))}"><Table>${headerRow}${dataRows}</Table></Worksheet>`;
    });
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheets.join('\n')}
</Workbook>
`;
    return {
      filename: `${input.dashboard.id.replace(/[^a-z0-9]+/gi, '_')}.xml`,
      contentType: 'application/vnd.ms-excel; charset=utf-8',
      body: Buffer.from(xml, 'utf8'),
    };
  }

  private exportPdf(input: ReportExportInput): ReportExportOutput {
    const lines: string[] = [
      `SmartERP — ${input.dashboard.title}`,
      `Persona: ${input.dashboard.persona}`,
      `Generated: ${new Date().toISOString()}`,
      '',
    ];
    for (const w of input.widgets) {
      lines.push(`# ${w.widgetId} (${w.projectionId})`);
      const headers = collectHeaders(w.rows);
      for (const r of w.rows.slice(0, 50)) {
        lines.push(
          `${r.key} | ${headers
            .map((h) => `${h}=${formatCell(r.payload[h])}`)
            .join(' | ')}`,
        );
      }
      lines.push('');
    }
    const pdf = renderMinimalPdf(lines);
    return {
      filename: `${input.dashboard.id.replace(/[^a-z0-9]+/gi, '_')}.pdf`,
      contentType: 'application/pdf',
      body: pdf,
    };
  }
}

function collectHeaders(rows: ReadModelRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r.payload ?? {})) set.add(k);
  }
  return Array.from(set).sort();
}

function formatCell(v: unknown): string | number {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return JSON.stringify(v);
}

function csvEscape(v: unknown): string {
  const s = typeof v === 'string' ? v : String(v ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeSheetName(s: string): string {
  return s.replace(/[\\/:?*\[\]]/g, '_').slice(0, 31);
}

/**
 * Minimal PDF 1.4 renderer — single-page, text-only, ASCII-friendly.
 * Generates a self-contained PDF without external dependencies. Useful
 * for v1 audit + scheduled-delivery contract tests; the production
 * polished generator lands in S20 (NIS2 Compliance Pack).
 */
function renderMinimalPdf(textLines: string[]): Buffer {
  const stream = textLines
    .map((l) => `(${pdfEscape(l)}) Tj T*`)
    .join('\n');
  const content = `BT
/F1 10 Tf
40 800 Td
14 TL
${stream}
ET`;
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  );
  objects.push(
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  );
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const offsets: number[] = [];
  let body = '%PDF-1.4\n';
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    body += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, 'latin1');
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
