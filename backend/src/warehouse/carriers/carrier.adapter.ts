/**
 * CarrierAdapter port (ADR-019).
 *
 * One per-vendor adapter per shipping carrier. Implementations live under
 * backend/src/warehouse/carriers/<vendor>.adapter.ts. Registered via
 * CarrierRegistry at composition time.
 */

export type CarrierId = 'bartolini' | 'gls' | 'brt' | 'sda' | 'poste' | 'dhl';

export interface ShipmentAddress {
  name: string;
  street: string;
  city: string;
  postalCode: string;
  province?: string;
  country: string; // ISO 3166-1 alpha-2
  contactPhone?: string;
  email?: string;
  vatNumber?: string;
}

export interface ShipmentParcel {
  weightGrams: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  description?: string;
}

export interface ShipmentQuoteRequest {
  fromAddress: ShipmentAddress;
  toAddress: ShipmentAddress;
  parcels: ShipmentParcel[];
  /** Optional carrier service code (e.g. 'standard', 'express'). */
  serviceCode?: string;
  insuranceValueCents?: number;
  /** Cash-on-delivery amount in cents (Italian "contrassegno"). */
  codAmountCents?: number;
}

export interface ShipmentQuoteResponse {
  carrierId: CarrierId;
  serviceCode: string;
  totalCostCents: number;
  currency: string; // ISO-4217
  estimatedTransitDays?: number;
  notes?: string;
}

export interface CreateShipmentRequest extends ShipmentQuoteRequest {
  reference: string; // SmartERP-side id (Shipment.shipmentNumber)
  pickupRequestedAt?: string; // ISO 8601
}

export interface CreateShipmentResponse {
  carrierId: CarrierId;
  carrierShipmentId: string; // vendor-side id
  trackingNumber: string;
  labelAvailable: boolean;
}

export interface TrackingEvent {
  at: string; // ISO 8601
  code: string;
  description: string;
  location?: string;
}

export interface TrackingStatus {
  carrierId: CarrierId;
  trackingNumber: string;
  status:
    | 'preparing'
    | 'ready_to_ship'
    | 'in_transit'
    | 'out_for_delivery'
    | 'delivered'
    | 'exception'
    | 'returned'
    | 'cancelled';
  events: TrackingEvent[];
  deliveredAt?: string;
}

export interface CarrierAdapter {
  readonly carrierId: CarrierId;
  quote(request: ShipmentQuoteRequest): Promise<ShipmentQuoteResponse>;
  createShipment(request: CreateShipmentRequest): Promise<CreateShipmentResponse>;
  fetchLabel(carrierShipmentId: string): Promise<Buffer>; // PDF
  track(trackingNumber: string): Promise<TrackingStatus>;
  cancelShipment(carrierShipmentId: string): Promise<void>;
}
