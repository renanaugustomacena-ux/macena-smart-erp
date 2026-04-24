/**
 * Italian IVA regime computation.
 *
 * Closes gap H-04: the GAPS audit flagged "forfettario" as a tenant
 * flag with no computation branch and "minimi" not branched anywhere.
 * This module centralises regime-aware invoice total computation so
 * `accounting.service.ts` and the future payroll/BOM costing paths
 * call the same logic.
 *
 * Regime reference (Agenzia delle Entrate, FatturaPA v1.2.2
 * RegimeFiscale codelist):
 *
 *   RF01  Ordinario
 *   RF02  Contribuenti minimi (art.1, c.96-117, L. 244/2007)
 *   RF04  Agricoltura / attività connesse (art.34, DPR 633/1972)
 *   RF05  Vendita sali e tabacchi
 *   RF06  Commercio fiammiferi
 *   RF07  Editoria
 *   RF08  Gestione pubblici telefoni
 *   RF09  Rivendita documenti trasporto
 *   RF10  Intrattenimenti
 *   RF11  Agenzie di viaggio
 *   RF12  Agriturismo
 *   RF13  Vendite a domicilio
 *   RF14  Rivendita beni usati
 *   RF15  Agenzie di vendite all'asta
 *   RF16  IVA per cassa P.A.
 *   RF17  IVA per cassa (art.32-bis)
 *   RF18  Altro
 *   RF19  Regime forfettario (art.1, c.54-89, L. 190/2014)
 */

export type RegimeFiscale =
  | 'RF01' | 'RF02' | 'RF04' | 'RF05' | 'RF06' | 'RF07' | 'RF08' | 'RF09'
  | 'RF10' | 'RF11' | 'RF12' | 'RF13' | 'RF14' | 'RF15' | 'RF16' | 'RF17'
  | 'RF18' | 'RF19';

export interface IvaComputationInput {
  regime: RegimeFiscale;
  taxableAmount: number;
  requestedIvaRate: number; // 0, 4, 5, 10, 22 (standard rates)
  splitPayment: boolean;    // art. 17-ter DPR 633/1972
  reverseCharge: boolean;   // N6.x natures
}

export interface IvaComputationResult {
  ivaRate: number;
  ivaAmount: number;
  ivaNature?: string; // e.g. N2.2, N6.3
  reasoning: string;
  /**
   * Amount owed by the buyer to the seller. For split-payment invoices
   * the IVA is paid by the buyer directly to the Treasury, so the
   * receivable equals the taxable base.
   */
  payableByBuyer: number;
  treasuryReceivableFromSeller: number;
  cassettaRegimeCode: RegimeFiscale; // pass-through for XML header
}

/**
 * Round to 2 decimals half-even (banker's rounding — what IT tax
 * authorities expect on VAT liquidations).
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute IVA for a single line or aggregated taxable base.
 *
 * Branching (gap H-04):
 *  - RF19 (forfettario) — zero IVA, ivaNature = N2.2 (operazioni non
 *    soggette ad IVA ex art.1 c.54-89 L.190/2014); invoice must carry
 *    RegimeFiscale=RF19 and the customary "Operazione senza IVA" clause.
 *  - RF02 (minimi) — zero IVA, ivaNature = N2.2; RegimeFiscale=RF02;
 *    bollo 2.00 EUR required if invoice amount > 77.47 (handled by the
 *    stamp-duty module, not here).
 *  - reverseCharge = true — ivaNature = N6.x (default N6.9); seller
 *    does not charge IVA; buyer self-assesses with autofattura.
 *  - splitPayment = true — IVA is charged on the invoice but paid by
 *    the P.A. buyer directly to the Treasury; receivable from the
 *    buyer equals the taxable base.
 *  - otherwise RF01/ordinary — standard IVA applies.
 */
export function computeIva(input: IvaComputationInput): IvaComputationResult {
  const { regime, taxableAmount, requestedIvaRate, splitPayment, reverseCharge } =
    input;

  // Forfettario and minimi are zero-IVA regimes.
  if (regime === 'RF19') {
    return {
      ivaRate: 0,
      ivaAmount: 0,
      ivaNature: 'N2.2',
      reasoning:
        'Regime forfettario (art.1 c.54-89 L.190/2014) — operazione non soggetta ad IVA',
      payableByBuyer: round2(taxableAmount),
      treasuryReceivableFromSeller: 0,
      cassettaRegimeCode: regime,
    };
  }
  if (regime === 'RF02') {
    return {
      ivaRate: 0,
      ivaAmount: 0,
      ivaNature: 'N2.2',
      reasoning:
        'Regime dei minimi (art.1 c.96-117 L.244/2007) — operazione non soggetta ad IVA',
      payableByBuyer: round2(taxableAmount),
      treasuryReceivableFromSeller: 0,
      cassettaRegimeCode: regime,
    };
  }

  // Reverse charge — N6.x, no IVA on the invoice.
  if (reverseCharge) {
    return {
      ivaRate: 0,
      ivaAmount: 0,
      ivaNature: 'N6.9',
      reasoning:
        'Reverse charge art.17 DPR 633/1972 — IVA assolta dal cessionario/committente',
      payableByBuyer: round2(taxableAmount),
      treasuryReceivableFromSeller: 0,
      cassettaRegimeCode: regime,
    };
  }

  // Ordinary computation.
  const ivaAmount = round2((taxableAmount * requestedIvaRate) / 100);
  if (splitPayment) {
    return {
      ivaRate: requestedIvaRate,
      ivaAmount,
      reasoning:
        'Split payment art. 17-ter DPR 633/1972 — IVA versata direttamente dall\'ente acquirente',
      payableByBuyer: round2(taxableAmount),
      treasuryReceivableFromSeller: 0,
      cassettaRegimeCode: regime,
    };
  }
  return {
    ivaRate: requestedIvaRate,
    ivaAmount,
    reasoning: 'Regime ordinario — IVA applicata e riscossa dal cedente',
    payableByBuyer: round2(taxableAmount + ivaAmount),
    treasuryReceivableFromSeller: ivaAmount,
    cassettaRegimeCode: regime,
  };
}
