import { Injectable, NotImplementedException } from '@nestjs/common';
import type { PecMailbox, PecMessage } from './pec-mailbox';

/**
 * IMAP-over-TLS PecMailbox — SKELETON (Sprint 14 / S14.4).
 *
 * Live implementation lands in plan §31.2 Sprint 24 (alongside the
 * BullMQ scheduler that polls every tenant's PEC mailbox at a
 * tenant-configurable cadence).
 *
 * Live-implementation notes for Sprint 24:
 *   - Use `imapflow` (npm) — actively maintained, supports IMAP4rev1 +
 *     STARTTLS + IMAPS, AsyncIterable API.
 *   - Per-tenant credentials live in `tenant.settings.pec` (encrypted
 *     per ADR-DA07): `host`, `port`, `username`, `password`,
 *     `mailbox` (default 'INBOX'), `tls` (default true).
 *   - Italian PEC providers require IMAPS on 993 (Aruba, Namirial,
 *     InfoCert all converge there).
 *   - Listen-only on the FatturaPA inbound folder; never delete or move
 *     messages — the legal regime requires PEC retention for the same
 *     10-year window as the SDI receipts.
 *   - Use IMAP IDLE for near-real-time arrival when the provider
 *     supports it (Aruba does; older Namirial servers do not — fall
 *     back to a 60-second poll).
 *   - Wrap network errors in RFC 7807 Problem-Details with
 *     `https://smarterp.it/errors/pec/<errorCode>` per ADR-011.
 *   - Per-call timeout 30s; circuit-breaker via HttpClientService
 *     (ADR-032) wrapper for the network primitives.
 */
@Injectable()
export class ImapPecMailbox implements PecMailbox {
  async listUnseen(_limit?: number): Promise<PecMessage[]> {
    throw new NotImplementedException(
      'ImapPecMailbox.listUnseen() not implemented — scheduled for plan §31.2 Sprint 24.',
    );
  }

  async markSeen(_messageId: string): Promise<void> {
    throw new NotImplementedException(
      'ImapPecMailbox.markSeen() not implemented — scheduled for plan §31.2 Sprint 24.',
    );
  }
}
