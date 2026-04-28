/**
 * ConservazioneAdapter port (ADR-016).
 *
 * One per-vendor adapter per Italian "Conservatore Accreditato AgID" used
 * for "conservazione a norma" of FatturaPA invoices and tax-relevant
 * documents (CAD artt. 43-44; DPCM 3/12/2013).
 *
 * Implementations live under
 * backend/src/conservazione/<vendor>.adapter.ts. Registered via
 * ConservazioneRegistry at composition time.
 */

export type ConservazioneVendorId = 'aruba' | 'infocert' | 'namirial';

/**
 * Document classes the platform sends to a Conservatore.
 *
 * Each maps to a different "tipologia documentale" in the vendor's
 * classification, but at the platform level we keep the canonical surface
 * tight: every send is one of these, and the per-vendor adapter handles
 * the upstream taxonomy mapping.
 */
export type ConservazioneDocClass =
  | 'fatturapa_attiva'
  | 'fatturapa_passiva'
  | 'sdi_receipt'
  | 'sdi_notification'
  | 'ddt'
  | 'fiscal_register'
  | 'contract'
  | 'other';

/**
 * The minimum metadata required by DPCM 3/12/2013 to index a document in
 * the conservation system. Every "versamento" (deposit) carries one
 * `IndexMetadata` block.
 *
 * `documentHashSha256` is the SHA-256 of the raw `documentBody` and is
 * recomputed by the adapter for each send to detect tampering between
 * SmartERP and the Conservatore.
 */
export interface IndexMetadata {
  /** Caller-side stable identifier (e.g., `SI-2026-00001`). */
  reference: string;
  /** Document class — drives per-vendor "tipologia documentale" mapping. */
  documentClass: ConservazioneDocClass;
  /** Issuer Codice Fiscale (16-char) or Partita IVA (11-digit). */
  issuerFiscalId: string;
  /** Recipient Codice Fiscale or Partita IVA, when applicable. */
  recipientFiscalId?: string;
  /** Document date (RFC 3339 date — `YYYY-MM-DD`). */
  documentDate: string;
  /** Document number (FatturaPA `Numero` or local sequence). */
  documentNumber?: string;
  /** Total amount in cents, for fiscal documents (R-D04). */
  totalAmountCents?: number;
  /** ISO-4217 currency code. */
  currency?: string;
  /** SHA-256 (lowercase hex) of `documentBody`. */
  documentHashSha256: string;
  /** Free-form additional tags the tenant indexes against. */
  tags?: string[];
}

/**
 * The "versamento" — what we send to the Conservatore.
 *
 * Holds the document body (the FatturaPA XML envelope or the SDI receipt
 * XML), any attachments (e.g., the SDI receipts that accompany an active
 * invoice), and the index metadata.
 */
export interface VersamentoRequest {
  /** Bytes of the primary document (FatturaPA XML envelope, SDI XML, etc.). */
  documentBody: Buffer;
  /** MIME type, e.g. `application/xml`, `application/pdf`. */
  documentMimeType: string;
  /** Index block (DPCM 3/12/2013 conformant). */
  index: IndexMetadata;
  /**
   * Optional attachments — typically the SDI receipts (RC, MC, NS, NE, MT,
   * EC) that accompany the active FatturaPA invoice in conservazione.
   */
  attachments?: Array<{
    filename: string;
    mimeType: string;
    body: Buffer;
    description?: string;
  }>;
  /** Caller's tenantId — propagated to per-vendor audit logs. */
  tenantId: string;
}

/**
 * The receipt the Conservatore returns at the end of a successful
 * "versamento". `rapportoDiVersamentoUrl` is the signed PDF the tenant can
 * surface in an Italian tax audit (it is the legal proof that the
 * document was archived per DPCM 3/12/2013 §5).
 */
export interface VersamentoReceipt {
  vendorId: ConservazioneVendorId;
  /** Vendor-side identifier — opaque to the platform. */
  versamentoId: string;
  /** SHA-256 of the archived bundle (document + attachments + index). */
  bundleHashSha256: string;
  /** RFC 3339 UTC timestamp from the Conservatore. */
  acknowledgedAt: string;
  /** Vendor-served URL for a signed PDF "rapporto di versamento". */
  rapportoDiVersamentoUrl: string;
  /** Vendor-side document class string — for diagnostic logging. */
  vendorDocClass?: string;
  /** Free-form vendor metadata, opaque to the platform. */
  vendorMetadata?: Record<string, unknown>;
}

/**
 * "Esibizione" (exhibit) — given a versamentoId, produce the legally
 * complete bundle the tenant must hand to a tax auditor. Includes:
 *   - Original document bytes (re-fetched from the Conservatore).
 *   - Original SDI receipts.
 *   - The index manifest signed by the Conservatore.
 *   - The "rapporto di versamento" PDF.
 *   - Optional "rapporto di esibizione" PDF (some Conservatori sign a
 *     fresh exhibit-time receipt to prove the bundle was retrieved
 *     unaltered).
 */
export interface EsibizionePackage {
  vendorId: ConservazioneVendorId;
  versamentoId: string;
  documentBody: Buffer;
  documentMimeType: string;
  attachments: Array<{ filename: string; mimeType: string; body: Buffer }>;
  manifestSignedBody: Buffer;
  rapportoDiVersamentoBody: Buffer;
  rapportoDiEsibizioneBody?: Buffer;
}

/**
 * Search query into the Conservatore's index. Every Conservatore exposes
 * at least these axes; vendor-specific filters go via `vendorFilters`.
 */
export interface ConservazioneSearchQuery {
  tenantId: string;
  documentClass?: ConservazioneDocClass;
  issuerFiscalId?: string;
  recipientFiscalId?: string;
  documentDateFrom?: string; // RFC 3339 date
  documentDateTo?: string;
  documentNumber?: string;
  tags?: string[];
  /** Free-form vendor-specific filters (opaque to the platform). */
  vendorFilters?: Record<string, unknown>;
  page?: number;
  pageSize?: number;
}

export interface ConservazioneIndexEntry {
  vendorId: ConservazioneVendorId;
  versamentoId: string;
  reference: string;
  documentClass: ConservazioneDocClass;
  documentDate: string;
  documentNumber?: string;
  totalAmountCents?: number;
  acknowledgedAt: string;
  rapportoDiVersamentoUrl: string;
}

/**
 * The port. Implementations live one-per-Conservatore.
 *
 * All methods are async and SHOULD wrap upstream errors in
 * RFC 7807 ProblemDetails (ADR-011) with the canonical `type` URI prefix
 * `https://smarterp.it/errors/conservazione/<vendorId>/<errorCode>`.
 */
export interface ConservazioneAdapter {
  readonly vendorId: ConservazioneVendorId;
  send(request: VersamentoRequest): Promise<VersamentoReceipt>;
  fetchReceipt(versamentoId: string): Promise<VersamentoReceipt>;
  exhibit(versamentoId: string): Promise<EsibizionePackage>;
  search(query: ConservazioneSearchQuery): Promise<ConservazioneIndexEntry[]>;
}
