import { Injectable, NotImplementedException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  Psd2Adapter,
  Psd2AdapterContext,
  Psd2Consent,
  Psd2PullResult,
} from './psd2.adapter';

@Injectable()
export class BperPsd2Adapter implements Psd2Adapter {
  readonly id = 'bper' as const;
  readonly displayName = 'BPER (XS2A)';

  async initiateConsent(ctx: Psd2AdapterContext): Promise<Psd2Consent> {
    if (ctx.mode === 'production') {
      throw new NotImplementedException(
        'BPER PSD2 production wiring — scheduled Sprint 32',
      );
    }
    return {
      consentId: `BPER-SBX-${crypto.randomUUID()}`,
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
        'BPER PSD2 production wiring — scheduled Sprint 32',
      );
    }
    return {
      transactions: sinceCursor ? [] : [],
      cursor: new Date().toISOString(),
    };
  }
}
