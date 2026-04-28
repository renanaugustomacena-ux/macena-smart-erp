import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  CarrierAdapter,
  CarrierId,
  CreateShipmentRequest,
  CreateShipmentResponse,
  ShipmentQuoteRequest,
  ShipmentQuoteResponse,
  TrackingStatus,
} from './carrier.adapter';

/**
 * Bartolini (BRT) carrier adapter — SKELETON (Sprint 13 / S13.4).
 *
 * Per ADR-019 the live integration lands in plan §31.2 Sprint 19. This
 * skeleton class:
 *   1. Pins the canonical CarrierAdapter contract for the implementation.
 *   2. Documents the upstream API surface (srv.brt.it endpoints).
 *   3. Throws `NotImplementedException` with a `Sunset` header describing
 *      when the live implementation is expected (Sprint 19, ~M-12) so any
 *      premature consumer fails loud.
 *
 * Live-implementation notes for Sprint 19:
 *   - Auth: per-tenant Bartolini-supplied "userid" + "password" or "API
 *     token". Stored under `tenant.settings.carriers.bartolini` (encrypted
 *     per ADR-DA07).
 *   - Quote endpoint: `POST https://api.brt.it/rest/v1/shipments/quote`.
 *   - Create-shipment: `POST .../v1/shipments`.
 *   - Label: `GET .../v1/shipments/{id}/label?format=pdf`.
 *   - Tracking: `GET .../v1/tracking/{trackingNumber}`.
 *   - Rate limit: 1 req / sec / API-token (per Bartolini docs Q1 2026).
 *   - Errors: JSON Problem-Details-like body; map to RFC 7807 with
 *     type-URI `https://smarterp.it/errors/carriers/bartolini/<code>`
 *     per ADR-011.
 *   - Wrap every call through HttpClientService (ADR-032) for timeout +
 *     retry + circuit-breaker.
 */
@Injectable()
export class BartoliniAdapter implements CarrierAdapter {
  readonly carrierId: CarrierId = 'bartolini';

  async quote(_request: ShipmentQuoteRequest): Promise<ShipmentQuoteResponse> {
    throw new NotImplementedException(
      'BartoliniAdapter.quote() not implemented — scheduled for plan §31.2 Sprint 19.',
    );
  }

  async createShipment(
    _request: CreateShipmentRequest,
  ): Promise<CreateShipmentResponse> {
    throw new NotImplementedException(
      'BartoliniAdapter.createShipment() not implemented — scheduled for plan §31.2 Sprint 19.',
    );
  }

  async fetchLabel(_carrierShipmentId: string): Promise<Buffer> {
    throw new NotImplementedException(
      'BartoliniAdapter.fetchLabel() not implemented — scheduled for plan §31.2 Sprint 19.',
    );
  }

  async track(_trackingNumber: string): Promise<TrackingStatus> {
    throw new NotImplementedException(
      'BartoliniAdapter.track() not implemented — scheduled for plan §31.2 Sprint 19.',
    );
  }

  async cancelShipment(_carrierShipmentId: string): Promise<void> {
    throw new NotImplementedException(
      'BartoliniAdapter.cancelShipment() not implemented — scheduled for plan §31.2 Sprint 19.',
    );
  }
}
