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
 * Aruba S.p.A. Conservazione adapter — SKELETON (Sprint 14 / S14.5).
 *
 * Aruba is the largest Italian Conservatore Accreditato AgID by volume.
 * Per ADR-016 the live integration lands in plan §31.2 Sprint 22. This
 * skeleton:
 *   1. Pins the canonical `ConservazioneAdapter` contract for the
 *      implementation.
 *   2. Documents the upstream API surface (Aruba `wsdoccons.arubapec.it`
 *      SOAP envelope; multi-part upload for the document body).
 *   3. Throws `NotImplementedException` with a `Sunset` note describing
 *      when the live implementation is expected (Sprint 22, ~M-15) so any
 *      premature consumer fails loud.
 *
 * Live-implementation notes for Sprint 22:
 *   - Auth: per-tenant Aruba "username" + "password" + per-tenant
 *     "codiceAzienda" (Aruba's customer-side organisation key). Stored
 *     under `tenant.settings.conservazione.aruba` (encrypted per
 *     ADR-DA07).
 *   - Endpoint: `https://wsdoccons.arubapec.it/wsdocService` (SOAP 1.1).
 *   - Operations:
 *       - `aggiungi_documento` — create the versamento.
 *       - `cerca_documenti` — index search.
 *       - `recupera_documento` — esibizione.
 *       - `recupera_rapporto_versamento` — fetch the signed PDF receipt.
 *   - Document upload uses `xop:Include` MTOM; the platform must base64
 *     the body before signing.
 *   - DPCM 3/12/2013 manifest: Aruba builds the `<DichiarazioneVersamento>`
 *     envelope server-side; the platform supplies the index metadata.
 *   - Errors: SOAP `<faultstring>`; map to RFC 7807 with type-URI
 *     `https://smarterp.it/errors/conservazione/aruba/<faultcode>` per
 *     ADR-011.
 *   - Wrap every call through HttpClientService (ADR-032) for timeout +
 *     retry + circuit-breaker.
 *   - Rate limit: 60 req / min / customer (per Aruba docs Q1 2026).
 */
@Injectable()
export class ArubaConservazioneAdapter implements ConservazioneAdapter {
  readonly vendorId: ConservazioneVendorId = 'aruba';

  async send(_request: VersamentoRequest): Promise<VersamentoReceipt> {
    throw new NotImplementedException(
      'ArubaConservazioneAdapter.send() not implemented — scheduled for plan §31.2 Sprint 22.',
    );
  }

  async fetchReceipt(_versamentoId: string): Promise<VersamentoReceipt> {
    throw new NotImplementedException(
      'ArubaConservazioneAdapter.fetchReceipt() not implemented — scheduled for plan §31.2 Sprint 22.',
    );
  }

  async exhibit(_versamentoId: string): Promise<EsibizionePackage> {
    throw new NotImplementedException(
      'ArubaConservazioneAdapter.exhibit() not implemented — scheduled for plan §31.2 Sprint 22.',
    );
  }

  async search(
    _query: ConservazioneSearchQuery,
  ): Promise<ConservazioneIndexEntry[]> {
    throw new NotImplementedException(
      'ArubaConservazioneAdapter.search() not implemented — scheduled for plan §31.2 Sprint 22.',
    );
  }
}
