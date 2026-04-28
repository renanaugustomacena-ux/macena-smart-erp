import type { SupplierInvoiceDiscrepancy } from './entities/supplier-invoice.entity';

/**
 * 3-way match (PO ↔ GR ↔ SI) — pure logic, no DB.
 *
 * Per plan §9.6.3 + §30.6.3:
 *   - Quantity match: SI.line.quantity ≈ Σ GR.line.acceptedQuantity ≈ PO.line.quantity (within tolerance).
 *   - Price match: SI.line.unitCostCents ≈ PO.line.unitCostCents (within tolerance).
 *   - Tax + total: SI.totalCents within tolerance of expected (subtotal × (1 + taxRate)).
 *
 * Tolerances configurable per supplier (default ±2% qty, ±0.5% price, ±1% total).
 *
 * Returns a list of `SupplierInvoiceDiscrepancy` rows. An empty list means
 * the invoice fully matches PO + GR within tolerance.
 */

export interface PoLineSnapshot {
  poLineId: string;
  productId: string;
  quantity: string;       // numeric-string; preserved precision
  unitCostCents: number;
  taxRate: number;
}

export interface GrLineSnapshot {
  poLineId: string;
  acceptedQuantity: string;
}

export interface SiLineSnapshot {
  invoiceLineId: string;
  poLineId: string | null; // unmatched if null
  quantity: string;
  unitCostCents: number;
  taxRate: number;
  lineTotalCents: number;
}

export interface MatchTolerances {
  /** Percent (0-100). Default 2.0 (±2%). */
  quantityPct?: number;
  /** Percent (0-100). Default 0.5 (±0.5%). */
  pricePct?: number;
  /** Percent (0-100). Default 1.0 (±1%). */
  totalPct?: number;
}

const DEFAULT_TOLERANCES: Required<MatchTolerances> = {
  quantityPct: 2.0,
  pricePct: 0.5,
  totalPct: 1.0,
};

function withinPct(expected: number, actual: number, pct: number): boolean {
  if (expected === 0) return actual === 0;
  const tolerance = Math.abs(expected * (pct / 100));
  return Math.abs(actual - expected) <= tolerance + 0.5; // +0.5 cent rounding tolerance
}

function withinPctDecimal(
  expected: string,
  actual: string,
  pct: number,
): boolean {
  const e = Number(expected);
  const a = Number(actual);
  if (e === 0) return a === 0;
  const tolerance = Math.abs(e * (pct / 100));
  return Math.abs(a - e) <= tolerance + 0.0001;
}

export interface ThreeWayMatchInput {
  poLines: PoLineSnapshot[];
  grLines: GrLineSnapshot[];
  siLines: SiLineSnapshot[];
  siTotalCents: number;
  tolerances?: MatchTolerances;
}

export interface ThreeWayMatchResult {
  matched: boolean;
  discrepancies: SupplierInvoiceDiscrepancy[];
}

export function runThreeWayMatch(input: ThreeWayMatchInput): ThreeWayMatchResult {
  const tol = { ...DEFAULT_TOLERANCES, ...(input.tolerances ?? {}) };
  const discrepancies: SupplierInvoiceDiscrepancy[] = [];

  // Aggregate accepted quantities per PO line.
  const acceptedByPoLine = new Map<string, number>();
  for (const grl of input.grLines) {
    acceptedByPoLine.set(
      grl.poLineId,
      (acceptedByPoLine.get(grl.poLineId) ?? 0) + Number(grl.acceptedQuantity),
    );
  }

  // Per-SI-line checks.
  for (const sil of input.siLines) {
    if (!sil.poLineId) {
      discrepancies.push({
        type: 'unmatched_line',
        invoiceLineId: sil.invoiceLineId,
        message: 'Invoice line has no matching PO line.',
      });
      continue;
    }
    const pol = input.poLines.find((p) => p.poLineId === sil.poLineId);
    if (!pol) {
      discrepancies.push({
        type: 'missing_po',
        invoiceLineId: sil.invoiceLineId,
        poLineId: sil.poLineId,
        message: `PO line ${sil.poLineId} not found.`,
      });
      continue;
    }
    // Quantity check: invoiced qty must be within tolerance of *accepted GR* qty.
    const acceptedQty = acceptedByPoLine.get(pol.poLineId) ?? 0;
    if (
      !withinPctDecimal(
        String(acceptedQty),
        sil.quantity,
        tol.quantityPct,
      )
    ) {
      discrepancies.push({
        type: 'quantity',
        poLineId: pol.poLineId,
        invoiceLineId: sil.invoiceLineId,
        expectedQuantity: String(acceptedQty),
        actualQuantity: sil.quantity,
        message: `Invoiced quantity ${sil.quantity} outside ±${tol.quantityPct}% of accepted ${acceptedQty}.`,
      });
    }
    // Price check.
    if (!withinPct(pol.unitCostCents, sil.unitCostCents, tol.pricePct)) {
      discrepancies.push({
        type: 'price',
        poLineId: pol.poLineId,
        invoiceLineId: sil.invoiceLineId,
        expectedCents: pol.unitCostCents,
        actualCents: sil.unitCostCents,
        message: `Invoiced unit cost ${sil.unitCostCents} cents outside ±${tol.pricePct}% of PO ${pol.unitCostCents} cents.`,
      });
    }
  }

  // Total check.
  const expectedTotal = input.siLines.reduce((s, l) => {
    const taxAmt = Math.round((l.lineTotalCents * l.taxRate) / 100);
    return s + l.lineTotalCents + taxAmt;
  }, 0);
  if (!withinPct(expectedTotal, input.siTotalCents, tol.totalPct)) {
    discrepancies.push({
      type: 'total',
      expectedCents: expectedTotal,
      actualCents: input.siTotalCents,
      message: `Invoice total ${input.siTotalCents} cents outside ±${tol.totalPct}% of expected ${expectedTotal} cents.`,
    });
  }

  return {
    matched: discrepancies.length === 0,
    discrepancies,
  };
}
