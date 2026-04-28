import {
  runThreeWayMatch,
  PoLineSnapshot,
  GrLineSnapshot,
  SiLineSnapshot,
} from './three-way-match';

describe('runThreeWayMatch (S14.3 — pure logic)', () => {
  function pol(over: Partial<PoLineSnapshot> = {}): PoLineSnapshot {
    return {
      poLineId: 'pol-1',
      productId: 'prod-1',
      quantity: '10',
      unitCostCents: 1000,
      taxRate: 22,
      ...over,
    };
  }
  function grl(over: Partial<GrLineSnapshot> = {}): GrLineSnapshot {
    return { poLineId: 'pol-1', acceptedQuantity: '10', ...over };
  }
  function sil(over: Partial<SiLineSnapshot> = {}): SiLineSnapshot {
    return {
      invoiceLineId: 'sil-1',
      poLineId: 'pol-1',
      quantity: '10',
      unitCostCents: 1000,
      taxRate: 22,
      lineTotalCents: 10_000,
      ...over,
    };
  }

  it('matches a clean 1-line PO → GR → SI', () => {
    const r = runThreeWayMatch({
      poLines: [pol()],
      grLines: [grl()],
      siLines: [sil()],
      siTotalCents: 12_200, // 10000 + 22% tax
    });
    expect(r.matched).toBe(true);
    expect(r.discrepancies).toEqual([]);
  });

  it('flags unmatched_line when SI line has no poLineId', () => {
    const r = runThreeWayMatch({
      poLines: [pol()],
      grLines: [grl()],
      siLines: [sil({ poLineId: null })],
      siTotalCents: 12_200,
    });
    expect(r.matched).toBe(false);
    expect(r.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'unmatched_line' }),
      ]),
    );
  });

  it('flags missing_po when SI references an unknown poLineId', () => {
    const r = runThreeWayMatch({
      poLines: [pol()],
      grLines: [grl()],
      siLines: [sil({ poLineId: 'pol-ZZZ' })],
      siTotalCents: 12_200,
    });
    expect(r.matched).toBe(false);
    expect(r.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'missing_po', poLineId: 'pol-ZZZ' }),
      ]),
    );
  });

  it('quantity within ±2% tolerance is accepted', () => {
    const r = runThreeWayMatch({
      poLines: [pol({ quantity: '100' })],
      grLines: [grl({ acceptedQuantity: '100' })],
      siLines: [sil({ quantity: '101', lineTotalCents: 101_000 })], // +1%
      siTotalCents: 123_220, // 101000 + 22%
    });
    expect(r.matched).toBe(true);
  });

  it('quantity outside ±2% tolerance is flagged', () => {
    const r = runThreeWayMatch({
      poLines: [pol({ quantity: '100' })],
      grLines: [grl({ acceptedQuantity: '100' })],
      siLines: [sil({ quantity: '105', lineTotalCents: 105_000 })], // +5%
      siTotalCents: 128_100,
    });
    expect(r.matched).toBe(false);
    expect(r.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'quantity',
          expectedQuantity: '100',
          actualQuantity: '105',
        }),
      ]),
    );
  });

  it('price within ±0.5% tolerance is accepted', () => {
    // 1000 cents → ±5 cents tolerance.
    const r = runThreeWayMatch({
      poLines: [pol()],
      grLines: [grl()],
      siLines: [sil({ unitCostCents: 1004, lineTotalCents: 10_040 })],
      siTotalCents: 12_249, // 10040*1.22 ≈ 12248.8
    });
    expect(r.matched).toBe(true);
  });

  it('price outside ±0.5% tolerance is flagged', () => {
    const r = runThreeWayMatch({
      poLines: [pol()],
      grLines: [grl()],
      siLines: [sil({ unitCostCents: 1100, lineTotalCents: 11_000 })], // +10%
      siTotalCents: 13_420,
    });
    expect(r.matched).toBe(false);
    expect(r.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'price',
          expectedCents: 1000,
          actualCents: 1100,
        }),
      ]),
    );
  });

  it('total outside ±1% tolerance is flagged', () => {
    const r = runThreeWayMatch({
      poLines: [pol()],
      grLines: [grl()],
      siLines: [sil()],
      siTotalCents: 13_500, // expected 12200; +10.7%
    });
    expect(r.matched).toBe(false);
    expect(r.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'total',
          expectedCents: 12_200,
          actualCents: 13_500,
        }),
      ]),
    );
  });

  it('multi-line PO + GR + SI happy path', () => {
    const r = runThreeWayMatch({
      poLines: [
        pol({ poLineId: 'pol-A', quantity: '10', unitCostCents: 500 }),
        pol({ poLineId: 'pol-B', quantity: '5', unitCostCents: 2000 }),
      ],
      grLines: [
        grl({ poLineId: 'pol-A', acceptedQuantity: '10' }),
        grl({ poLineId: 'pol-B', acceptedQuantity: '5' }),
      ],
      siLines: [
        sil({
          invoiceLineId: 'sil-A',
          poLineId: 'pol-A',
          quantity: '10',
          unitCostCents: 500,
          lineTotalCents: 5000,
        }),
        sil({
          invoiceLineId: 'sil-B',
          poLineId: 'pol-B',
          quantity: '5',
          unitCostCents: 2000,
          lineTotalCents: 10_000,
        }),
      ],
      siTotalCents: 18_300, // (5000 + 10000) × 1.22
    });
    expect(r.matched).toBe(true);
  });

  it('partial-receive case: GR < PO, SI matches GR (within tolerance)', () => {
    const r = runThreeWayMatch({
      poLines: [pol({ quantity: '100' })],
      grLines: [grl({ acceptedQuantity: '70' })], // partial receive
      siLines: [sil({ quantity: '70', lineTotalCents: 70_000 })],
      siTotalCents: 85_400,
    });
    expect(r.matched).toBe(true);
  });

  it('rejected-only GR: SI for the rejected qty is flagged', () => {
    const r = runThreeWayMatch({
      poLines: [pol({ quantity: '100' })],
      grLines: [grl({ acceptedQuantity: '0' })],
      siLines: [sil({ quantity: '100', lineTotalCents: 100_000 })],
      siTotalCents: 122_000,
    });
    expect(r.matched).toBe(false);
    expect(r.discrepancies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'quantity' }),
      ]),
    );
  });

  it('honours custom tolerances', () => {
    const r = runThreeWayMatch({
      poLines: [pol()],
      grLines: [grl()],
      siLines: [sil({ unitCostCents: 1100, lineTotalCents: 11_000 })],
      siTotalCents: 13_420,
      tolerances: { pricePct: 15.0, totalPct: 15.0 }, // explicit looser
    });
    expect(r.matched).toBe(true);
  });
});
