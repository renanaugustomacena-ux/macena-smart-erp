/**
 * PecMailbox port — pure interface, no transport (Sprint 14 / S14.4).
 *
 * Italian "Posta Elettronica Certificata" (PEC) is the legal-grade email
 * channel through which the SDI delivers FatturaPA passive-cycle invoices
 * to the customer's PEC mailbox. A passive-cycle ingester polls the
 * tenant's PEC mailbox, extracts the FatturaPA XML attachments (and the
 * SDI receipts that travel alongside them), and creates a
 * `SupplierInvoice` per ProcurementService.createSupplierInvoice.
 *
 * The port is transport-agnostic — the live implementation (Sprint 24)
 * uses IMAP-over-TLS against the tenant's PEC provider (Aruba PEC,
 * Namirial PEC, InfoCert Legalmail, ...). Tests substitute an in-memory
 * mailbox.
 */

export interface PecMessageAttachment {
  filename: string;
  mimeType: string;
  body: Buffer;
}

export interface PecMessage {
  /** PEC provider's stable id (IMAP UID; opaque to the platform). */
  messageId: string;
  /** From: address (the SDI sender if this is a FatturaPA delivery). */
  from: string;
  /** To: address (the tenant's PEC). */
  to: string;
  subject: string;
  /** RFC 3339 UTC. */
  receivedAt: string;
  attachments: PecMessageAttachment[];
}

export interface PecMailbox {
  /**
   * Returns unseen messages in the mailbox, optionally limited.
   * Implementations MUST NOT mark messages as seen — that is an explicit
   * subsequent call once the platform has durably acknowledged the
   * message.
   */
  listUnseen(limit?: number): Promise<PecMessage[]>;

  /**
   * Mark a message as seen (i.e., processed) so subsequent polls do not
   * re-deliver it. Idempotent.
   */
  markSeen(messageId: string): Promise<void>;
}
