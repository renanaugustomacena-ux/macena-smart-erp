/**
 * PSD2 (Berlin Group XS2A) adapter port (plan §31.1 Sprint 23 / S23.2).
 *
 * Italian banks expose XS2A through their dev portals (Intesa Sanpaolo
 * via "Intesa Sanpaolo Open Banking", UniCredit via "UniCredit XS2A",
 * BPER via "BPER Open Banking"). The contract below is the platform's
 * canonical surface; per-bank adapters wrap the bank-specific OAuth
 * flow + endpoint shape.
 *
 * v1 ships the Intesa skeleton in sandbox mode (per the InfoCert
 * pattern in S16.4). Production wiring lands in Sprint 31 alongside
 * the second + third bank adapters.
 */

export interface Psd2Consent {
  consentId: string;
  validUntil: string;
  scaStatus: 'received' | 'authenticated' | 'expired';
}

export interface Psd2Transaction {
  externalId: string;
  valueDate: string;
  bookingDate: string;
  amountCents: number;
  currency: string;
  description: string;
  counterpartyName: string | null;
  counterpartyIban: string | null;
}

export interface Psd2PullResult {
  transactions: Psd2Transaction[];
  cursor: string | null;
}

export interface Psd2AdapterContext {
  tenantId: string;
  ibanPlaintext: string;
  consent: Psd2Consent | null;
  mode: 'sandbox' | 'production';
}

export interface Psd2Adapter {
  readonly id: 'intesa' | 'unicredit' | 'bper';
  readonly displayName: string;
  initiateConsent(ctx: Psd2AdapterContext): Promise<Psd2Consent>;
  pullTransactions(
    ctx: Psd2AdapterContext,
    sinceCursor: string | null,
  ): Promise<Psd2PullResult>;
}
