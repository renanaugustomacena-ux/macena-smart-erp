import { Injectable, NotImplementedException } from '@nestjs/common';
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
 * InfoCert S.p.A. Conservazione adapter — SKELETON (Sprint 14 / S14.5).
 *
 * InfoCert is the second-largest Italian Conservatore Accreditato AgID by
 * volume; widely used by professional firms (commercialisti, avvocati).
 * Per ADR-016 it is the platform's second-vendor for failover and
 * negotiation leverage. The live integration lands in plan §31.2 Sprint
 * 23. This skeleton:
 *   1. Pins the canonical `ConservazioneAdapter` contract for the
 *      implementation.
 *   2. Documents the upstream API surface (InfoCert
 *      `services.infocert.it/conservazione` REST envelope; JWT-bearer
 *      auth).
 *   3. Throws `NotImplementedException` with a `Sunset` note describing
 *      when the live implementation is expected (Sprint 23, ~M-16) so any
 *      premature consumer fails loud.
 *
 * Live-implementation notes for Sprint 23:
 *   - Auth: OAuth 2.0 client-credentials flow against
 *     `https://oauth.infocert.it/oauth2/token`. Per-tenant `clientId` +
 *     `clientSecret` stored under `tenant.settings.conservazione.infocert`
 *     (encrypted per ADR-DA07). Access token has 1h TTL; the adapter
 *     caches it via `HttpClientService.tokenCache`.
 *   - Endpoint: `https://services.infocert.it/conservazione/v1` (REST/JSON).
 *   - Operations:
 *       - `POST /versamenti` — create the versamento (multipart/form-data
 *         with the document body + `metadata.json` index manifest).
 *       - `GET  /versamenti/{id}` — fetch the receipt.
 *       - `GET  /versamenti/{id}/esibizione` — full bundle download
 *         (returns a tar.gz with documentBody + manifest + rapporto).
 *       - `POST /ricerca` — index search (JSON query body).
 *   - DPCM 3/12/2013 manifest: InfoCert expects the index manifest as a
 *     JSON object embedded in the multipart request; the adapter
 *     constructs it from `IndexMetadata` server-side.
 *   - Errors: JSON Problem-Details-like body
 *     (`{ status, code, detail, ... }`); map to RFC 7807 with type-URI
 *     `https://smarterp.it/errors/conservazione/infocert/<code>` per
 *     ADR-011.
 *   - Wrap every call through HttpClientService (ADR-032) for timeout +
 *     retry + circuit-breaker.
 *   - Rate limit: 100 req / min / clientId (per InfoCert docs Q1 2026).
 */
@Injectable()
export class InfoCertConservazioneAdapter implements ConservazioneAdapter {
  readonly vendorId: ConservazioneVendorId = 'infocert';

  async send(_request: VersamentoRequest): Promise<VersamentoReceipt> {
    throw new NotImplementedException(
      'InfoCertConservazioneAdapter.send() not implemented — scheduled for plan §31.2 Sprint 23.',
    );
  }

  async fetchReceipt(_versamentoId: string): Promise<VersamentoReceipt> {
    throw new NotImplementedException(
      'InfoCertConservazioneAdapter.fetchReceipt() not implemented — scheduled for plan §31.2 Sprint 23.',
    );
  }

  async exhibit(_versamentoId: string): Promise<EsibizionePackage> {
    throw new NotImplementedException(
      'InfoCertConservazioneAdapter.exhibit() not implemented — scheduled for plan §31.2 Sprint 23.',
    );
  }

  async search(
    _query: ConservazioneSearchQuery,
  ): Promise<ConservazioneIndexEntry[]> {
    throw new NotImplementedException(
      'InfoCertConservazioneAdapter.search() not implemented — scheduled for plan §31.2 Sprint 23.',
    );
  }
}
