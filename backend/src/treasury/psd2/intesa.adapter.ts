import { Injectable, NotImplementedException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  Psd2Adapter,
  Psd2AdapterContext,
  Psd2Consent,
  Psd2PullResult,
} from './psd2.adapter';

/**
 * IntesaPsd2Adapter — first PSD2 (XS2A) adapter (S23.2).
 *
 * Sandbox mode returns deterministic synthetic consents + transactions
 * so end-to-end + reconciliation flows can be exercised before the
 * Sprint 31 production wiring. Production mode throws
 * NotImplementedException so any premature consumer fails loud.
 *
 * Live wiring notes (Sprint 31):
 *   - OAuth 2.0 client-credentials against
 *     `auth.intesa.it/oauth2/token`; per-tenant clientId + clientSecret
 *     stored under `tenant.settings.psd2.intesa.*` (encrypted per
 *     ADR-DA07).
 *   - SCA (Strong Customer Authentication) flow per Berlin Group v1.3.13
 *     (decoupled redirect; the tenant's account holder authenticates
 *     in the Intesa app and SmartERP polls the consent endpoint until
 *     `scaStatus = authenticated`).
 *   - Transactions endpoint: `/v1/accounts/{accountId}/transactions`.
 *   - Rate limit per Intesa docs (Q1 2026): 60 req/min/clientId.
 */
@Injectable()
export class IntesaPsd2Adapter implements Psd2Adapter {
  readonly id = 'intesa' as const;
  readonly displayName = 'Intesa Sanpaolo (XS2A)';

  async initiateConsent(ctx: Psd2AdapterContext): Promise<Psd2Consent> {
    if (ctx.mode === 'production') {
      throw new NotImplementedException(
        'Intesa PSD2 production wiring deferred to plan §31.2 Sprint 31',
      );
    }
    return {
      consentId: `INTESA-SBX-${crypto.randomUUID()}`,
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
        'Intesa PSD2 production wiring deferred to plan §31.2 Sprint 31',
      );
    }
    const synthetic = [
      {
        externalId: `INTESA-SBX-TX-${crypto.randomUUID()}`,
        valueDate: new Date().toISOString().slice(0, 10),
        bookingDate: new Date().toISOString().slice(0, 10),
        amountCents: 12_500,
        currency: 'EUR',
        description: 'BONIFICO RICEVUTO ACME SPA FATTURA 2026/0001',
        counterpartyName: 'Acme Spa',
        counterpartyIban: 'IT60X0542811101000000123456',
      },
    ];
    return {
      transactions: sinceCursor ? [] : synthetic,
      cursor: new Date().toISOString(),
    };
  }
}
