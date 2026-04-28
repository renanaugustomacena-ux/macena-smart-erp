import { Injectable, NotImplementedException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  Psd2Adapter,
  Psd2AdapterContext,
  Psd2Consent,
  Psd2PullResult,
} from './psd2.adapter';

/**
 * UnicreditPsd2Adapter (plan §31.2 Sprint 31). Sandbox-mode mirror of
 * IntesaPsd2Adapter; production wiring against UniCredit XS2A lands
 * in the Sprint 32 release branch.
 */
@Injectable()
export class UnicreditPsd2Adapter implements Psd2Adapter {
  readonly id = 'unicredit' as const;
  readonly displayName = 'UniCredit (XS2A)';

  async initiateConsent(ctx: Psd2AdapterContext): Promise<Psd2Consent> {
    if (ctx.mode === 'production') {
      throw new NotImplementedException(
        'UniCredit PSD2 production wiring — scheduled Sprint 32',
      );
    }
    return {
      consentId: `UCRED-SBX-${crypto.randomUUID()}`,
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      scaStatus: 'authenticated',
    };
  }

  async pullTransactions(
    ctx: Psd2AdapterContext,
    sinceCursor: string | null,
  ): Promise<Psd2PullResult> {
    if (ctx.mode === 'production') {
      throw new NotImplementedException(
        'UniCredit PSD2 production wiring — scheduled Sprint 32',
      );
    }
    return {
      transactions: sinceCursor
        ? []
        : [
            {
              externalId: `UCRED-SBX-TX-${crypto.randomUUID()}`,
              valueDate: new Date().toISOString().slice(0, 10),
              bookingDate: new Date().toISOString().slice(0, 10),
              amountCents: -45_000,
              currency: 'EUR',
              description: 'BONIFICO USCITA FORNITORE BETA SRL',
              counterpartyName: 'Beta Srl',
              counterpartyIban: 'IT89A0306909606100000123456',
            },
          ],
      cursor: new Date().toISOString(),
    };
  }
}
