/**
 * Minimal PDF 1.4 renderer — single-flow, multi-line text-only
 * (plan §31.1 Sprint 20 / S20.1).
 *
 * Mirrors the renderer used by the BI ReportExporter (S18.5) so the
 * compliance team has a self-contained PDF generator without
 * importing puppeteer / pdfkit. Production polish (logo, sectioning,
 * page-break handling) lands in S35 alongside the SOC 2 audit prep.
 */
export function renderMinimalPdf(textLines: string[]): Buffer {
  const lines = paginate(textLines, 56);
  const pages = lines.map((page) => buildPageStream(page));

  // Object 1 = catalog, 2 = pages tree, 3..N = page objects + content
  // streams + font.
  const fontObj = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
  const objects: string[] = [];
  // Reserve 0 (unused).
  objects.push('CATALOG');
  objects.push('PAGES');
  for (const _ of pages) {
    objects.push('PAGE');
    objects.push('CONTENT');
  }
  objects.push(fontObj);

  // Resolve placeholders.
  const fontIndex = objects.length; // 1-based id of the font obj
  const pagesObj = `<< /Type /Pages /Kids [${pages
    .map((_, i) => `${3 + i * 2} 0 R`)
    .join(' ')}] /Count ${pages.length} >>`;
  const catalog = '<< /Type /Catalog /Pages 2 0 R >>';
  for (let i = 0; i < pages.length; i++) {
    const pageId = 3 + i * 2;
    const contentId = pageId + 1;
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontIndex} 0 R >> >> >>`;
    const stream = pages[i];
    objects[contentId - 1] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  }
  objects[0] = catalog;
  objects[1] = pagesObj;

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

function paginate(lines: string[], linesPerPage: number): string[][] {
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(['']);
  return pages;
}

function buildPageStream(page: string[]): string {
  const stream = page.map((l) => `(${pdfEscape(l)}) Tj T*`).join('\n');
  return `BT
/F1 10 Tf
40 760 Td
13 TL
${stream}
ET`;
}

function pdfEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}
