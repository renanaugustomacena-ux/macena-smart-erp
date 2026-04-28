import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  ConservazioneAdapter,
  ConservazioneIndexEntry,
  ConservazioneSearchQuery,
  ConservazioneVendorId,
  EsibizionePackage,
  VersamentoReceipt,
  VersamentoRequest,
} from './conservazione.adapter';

/**
 * InfoCertConservazioneAdapter — second-vendor for Conservazione a Norma
 * (ADR-016 port; ADR-025 tier policy; plan §31.1 Sprint 16 / S16.4).
 *
 * Mode resolution (per `tenant.settings.conservazione.infocert.mode`):
 *
 *   - 'sandbox'    — the adapter returns deterministic synthetic
 *                    receipts. Used by demo tenants, contract tests, and
 *                    the failover path of the Conservazione orchestrator
 *                    while the production wiring is still on the
 *                    plan §31.2 Sprint 23 schedule.
 *
 *   - 'production' — the adapter is **not yet wired**; the live
 *                    integration against
 *                    `https://services.infocert.it/conservazione/v1`
 *                    lands in plan §31.2 Sprint 23. Until then a request
 *                    in production mode throws `NotImplementedException`
 *                    so any premature consumer fails loud.
 *
 * Live-implementation notes (carried forward from S14.5; no change to
 * scope versus ADR-016):
 *   - Auth: OAuth 2.0 client-credentials flow against
 *     `https://oauth.infocert.it/oauth2/token`. Per-tenant `clientId` +
 *     `clientSecret` stored under `tenant.settings.conservazione.infocert`
 *     (encrypted per ADR-DA07). Access token has 1h TTL; cached via
 *     `HttpClientService.tokenCache`.
 *   - Endpoint: `https://services.infocert.it/conservazione/v1` (REST).
 *   - DPCM 3/12/2013 manifest constructed from `IndexMetadata`
 *     server-side and posted as `metadata.json` part of a multipart
 *     upload alongside the document body.
 *   - Errors: RFC 7807 mapping with type-URI prefix
 *     `https://smarterp.it/errors/conservazione/infocert/<code>`.
 *   - Wrap calls through HttpClientService (ADR-032) for timeout +
 *     retry + circuit-breaker.
 *   - Rate limit: 100 req/min/clientId (per InfoCert docs Q1 2026).
 */
type InfoCertMode = 'sandbox' | 'production';

@Injectable()
export class InfoCertConservazioneAdapter implements ConservazioneAdapter {
  readonly vendorId: ConservazioneVendorId = 'infocert';
  private readonly logger = new Logger(InfoCertConservazioneAdapter.name);

  // The mode is request-local for now (read from the request's tenant
  // settings before the adapter is invoked). The orchestrator passes the
  // resolved mode via `request.tenantId` lookup → `tenant.settings`.
  // For testability + sprint-16 scope we read the mode from a process
  // env override (`CONSERVAZIONE_INFOCERT_MODE`) if the call site has
  // not stashed a mode on the request. Production wiring (Sprint 23)
  // will replace this with a per-tenant lookup.
  async send(request: VersamentoRequest): Promise<VersamentoReceipt> {
    const mode = this.resolveMode(request);
    if (mode === 'production') {
      throw new NotImplementedException(
        'InfoCertConservazioneAdapter.send(production) not implemented — scheduled for plan §31.2 Sprint 23.',
      );
    }
    return this.synthesiseReceipt(request);
  }

  async fetchReceipt(versamentoId: string): Promise<VersamentoReceipt> {
    if (this.resolveMode() === 'production') {
      throw new NotImplementedException(
        'InfoCertConservazioneAdapter.fetchReceipt(production) not implemented — scheduled for plan §31.2 Sprint 23.',
      );
    }
    return {
      vendorId: this.vendorId,
      versamentoId,
      bundleHashSha256: '0'.repeat(64),
      acknowledgedAt: new Date().toISOString(),
      rapportoDiVersamentoUrl: `https://sandbox.infocert.smarterp.local/rapporto/${versamentoId}`,
      vendorDocClass: 'sandbox',
    };
  }

  async exhibit(_versamentoId: string): Promise<EsibizionePackage> {
    throw new NotImplementedException(
      'InfoCertConservazioneAdapter.exhibit() requires production wiring — scheduled for plan §31.2 Sprint 23.',
    );
  }

  async search(
    _query: ConservazioneSearchQuery,
  ): Promise<ConservazioneIndexEntry[]> {
    if (this.resolveMode() === 'production') {
      throw new NotImplementedException(
        'InfoCertConservazioneAdapter.search(production) not implemented — scheduled for plan §31.2 Sprint 23.',
      );
    }
    return [];
  }

  // ─── Helpers ────────────────────────────────────────────────

  private resolveMode(request?: { tenantId?: string }): InfoCertMode {
    void request;
    const env = (process.env.CONSERVAZIONE_INFOCERT_MODE ?? 'sandbox').trim();
    return env === 'production' ? 'production' : 'sandbox';
  }

  private synthesiseReceipt(request: VersamentoRequest): VersamentoReceipt {
    const declaredHash = request.index.documentHashSha256;
    const recomputedHash = crypto
      .createHash('sha256')
      .update(request.documentBody)
      .digest('hex');
    if (declaredHash && declaredHash !== recomputedHash) {
      this.logger.warn({
        event: 'infocert.sandbox.hash_mismatch',
        reference: request.index.reference,
      });
    }

    const bundleHash = crypto
      .createHash('sha256')
      .update(recomputedHash)
      .update(JSON.stringify(request.index))
      .digest('hex');
    const versamentoId = `IC-SBX-${crypto.randomUUID()}`;

    this.logger.log({
      event: 'infocert.sandbox.send',
      reference: request.index.reference,
      versamentoId,
    });

    return {
      vendorId: this.vendorId,
      versamentoId,
      bundleHashSha256: bundleHash,
      acknowledgedAt: new Date().toISOString(),
      rapportoDiVersamentoUrl: `https://sandbox.infocert.smarterp.local/rapporto/${versamentoId}`,
      vendorDocClass: 'sandbox',
      vendorMetadata: {
        sandbox: true,
        documentClass: request.index.documentClass,
      },
    };
  }
}
