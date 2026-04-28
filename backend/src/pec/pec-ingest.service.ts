import { Injectable, Logger } from '@nestjs/common';
import {
  FatturaPaParseError,
  parseFatturaPa,
  type ParsedFatturaPa,
} from './fatturapa-passive-parser';
import type { PecMailbox, PecMessage } from './pec-mailbox';

/**
 * Per-tenant PEC ingest orchestrator (Sprint 14 / S14.4).
 *
 * Pulls unseen messages from the tenant's PEC mailbox, extracts the
 * FatturaPA XML attachments (the SDI delivers passive-cycle invoices as
 * `IT12345678901_00001.xml` or `.xml.p7m`-signed), parses them, and
 * surfaces a per-message `IngestOutcome` the caller (a BullMQ worker, a
 * REST endpoint, an integration test) consumes to populate the
 * SupplierInvoice. Pure logic at this layer — no DB.
 *
 * The downstream wiring to `ProcurementService.createSupplierInvoice` is
 * an explicit step the BullMQ worker (Sprint 24) performs after
 * resolving `supplierVatNumber` → `supplierId` against the Suppliers
 * directory and rejecting messages whose `customerVatNumber` does not
 * match the tenant's VAT.
 */

export interface PecIngestSupplierInvoiceCandidate {
  /** Parsed FatturaPA payload — the worker turns this into CreateSupplierInvoiceDto. */
  parsed: ParsedFatturaPa;
  /** Original PEC message id — for audit + idempotent re-ingest guard. */
  pecMessageId: string;
  /** XML body bytes — for conservazione handoff. */
  rawXml: Buffer;
  /** XML filename — `IT12345678901_00001.xml`. */
  filename: string;
}

export interface PecIngestErrorOutcome {
  pecMessageId: string;
  filename: string;
  errorCode: string;
  errorMessage: string;
}

export interface PecIngestSummary {
  tenantId: string;
  inspectedMessages: number;
  candidates: PecIngestSupplierInvoiceCandidate[];
  errors: PecIngestErrorOutcome[];
}

const FATTURAPA_NAME = /^IT[A-Z0-9]+_[A-Z0-9]+\.xml(?:\.p7m)?$/i;

@Injectable()
export class PecIngestService {
  private readonly logger = new Logger(PecIngestService.name);

  /**
   * Pull and parse unseen FatturaPA attachments. Does NOT mark messages
   * seen — the caller decides per-candidate whether ingestion succeeded
   * downstream and acks accordingly (R-A12 idempotency).
   */
  async listFatturaPaCandidates(
    tenantId: string,
    mailbox: PecMailbox,
    limit = 100,
  ): Promise<PecIngestSummary> {
    const messages = await mailbox.listUnseen(limit);
    const candidates: PecIngestSupplierInvoiceCandidate[] = [];
    const errors: PecIngestErrorOutcome[] = [];

    for (const msg of messages) {
      const fpaAttachments = pickFatturaPaAttachments(msg);
      if (fpaAttachments.length === 0) {
        // Not an SDI delivery — leave untouched for the operator's eyes.
        continue;
      }
      for (const att of fpaAttachments) {
        try {
          // The .xml.p7m branch needs CMS unwrap (out of scope for
          // skeleton; live worker pulls in `node-forge` + cosign in
          // Sprint 24). Plain .xml: parse directly.
          if (att.filename.toLowerCase().endsWith('.p7m')) {
            errors.push({
              pecMessageId: msg.messageId,
              filename: att.filename,
              errorCode: 'p7m_unwrap_not_implemented',
              errorMessage:
                'Signed .xml.p7m attachments are not yet unwrapped — scheduled for plan §31.2 Sprint 24.',
            });
            continue;
          }
          const xml = att.body.toString('utf8');
          const parsed = parseFatturaPa(xml);
          candidates.push({
            parsed,
            pecMessageId: msg.messageId,
            rawXml: att.body,
            filename: att.filename,
          });
        } catch (err) {
          if (err instanceof FatturaPaParseError) {
            errors.push({
              pecMessageId: msg.messageId,
              filename: att.filename,
              errorCode: err.code,
              errorMessage: err.message,
            });
          } else {
            const m = err instanceof Error ? err.message : String(err);
            errors.push({
              pecMessageId: msg.messageId,
              filename: att.filename,
              errorCode: 'unexpected',
              errorMessage: m.slice(0, 2000),
            });
          }
        }
      }
    }

    const summary: PecIngestSummary = {
      tenantId,
      inspectedMessages: messages.length,
      candidates,
      errors,
    };

    this.logger.log({
      event: 'pec.ingest_summary',
      tenantId,
      inspectedMessages: summary.inspectedMessages,
      candidateCount: candidates.length,
      errorCount: errors.length,
    });

    return summary;
  }
}

function pickFatturaPaAttachments(msg: PecMessage) {
  return msg.attachments.filter(
    (a) =>
      FATTURAPA_NAME.test(a.filename) ||
      a.mimeType === 'application/xml' ||
      a.mimeType === 'text/xml',
  );
}
