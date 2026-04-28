import {
  IsString,
  IsUUID,
  IsArray,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
  ArrayMinSize,
  ValidateNested,
  Length,
  IsNumberString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseRequisitionLineInputDto {
  @IsUUID() productId: string;
  @IsString() @Length(1, 500) description: string;
  /** Decimal-string to preserve precision in transit. */
  @IsNumberString() quantity: string;
  @IsString() @Length(1, 20) @IsOptional() unitOfMeasure?: string;
  @IsInt() @Min(0) @IsOptional() estimatedUnitCostCents?: number;
  @IsUUID() @IsOptional() preferredSupplierId?: string;
  @IsDateString() @IsOptional() needByDate?: string;
  @IsString() @IsOptional() notes?: string;
}

export class CreatePurchaseRequisitionDto {
  @IsUUID() requestedBy: string;
  @IsDateString() requestedDate: string;
  @IsDateString() @IsOptional() needByDate?: string;
  @IsString() @IsOptional() notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequisitionLineInputDto)
  lines: PurchaseRequisitionLineInputDto[];
}

export class ApprovePurchaseRequisitionDto {
  @IsUUID() approverUserId: string;
  @IsString() @IsOptional() comment?: string;
}

export class RejectPurchaseRequisitionDto {
  @IsUUID() approverUserId: string;
  @IsString() comment: string;
}

export class ConvertPurchaseRequisitionDto {
  @IsUUID() supplierId: string;
  @IsDateString() orderDate: string;
  @IsDateString() @IsOptional() expectedDeliveryDate?: string;
  @IsUUID() @IsOptional() shipToWarehouseId?: string;
  @IsString()
  @Length(3, 3)
  @IsIn([
    'EXW',
    'FCA',
    'CPT',
    'CIP',
    'DAP',
    'DPU',
    'DDP',
    'FAS',
    'FOB',
    'CFR',
    'CIF',
  ])
  @IsOptional()
  shippingTermsIncoterms?: string;
  @IsInt() @Min(0) @IsOptional() paymentTermsDays?: number;
}

export class PurchaseOrderLineInputDto {
  @IsUUID() productId: string;
  @IsString() @Length(1, 500) description: string;
  @IsNumberString() quantity: string;
  @IsString() @Length(1, 20) @IsOptional() unitOfMeasure?: string;
  @IsInt() @Min(0) unitCostCents: number;
  @IsInt() @Min(0) @Max(99) @IsOptional() taxRate?: number;
  @IsDateString() @IsOptional() expectedDeliveryDate?: string;
  @IsString() @IsOptional() notes?: string;
}

export class CreatePurchaseOrderDto {
  @IsUUID() supplierId: string;
  @IsUUID() @IsOptional() requisitionId?: string;
  @IsDateString() orderDate: string;
  @IsDateString() @IsOptional() expectedDeliveryDate?: string;
  @IsUUID() @IsOptional() shipToWarehouseId?: string;
  @IsInt() @Min(0) @IsOptional() paymentTermsDays?: number;
  @IsString() @IsOptional() paymentMethod?: string;
  @IsString()
  @Length(3, 3)
  @IsIn([
    'EXW',
    'FCA',
    'CPT',
    'CIP',
    'DAP',
    'DPU',
    'DDP',
    'FAS',
    'FOB',
    'CFR',
    'CIF',
  ])
  @IsOptional()
  shippingTermsIncoterms?: string;
  @IsString() @Length(3, 3) @IsOptional() currency?: string;
  @IsString() @IsOptional() notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderLineInputDto)
  lines: PurchaseOrderLineInputDto[];
}

export class CancelPurchaseOrderDto {
  @IsString() reason: string;
}

// --- RequestForQuote DTOs (S13.2) -----------------------------------------

export class RequestForQuoteLineInputDto {
  @IsUUID() productId: string;
  @IsString() @Length(1, 500) description: string;
  @IsNumberString() quantity: string;
  @IsString() @Length(1, 20) @IsOptional() unitOfMeasure?: string;
  @IsDateString() @IsOptional() needByDate?: string;
}

export class CreateRequestForQuoteDto {
  @IsUUID() requesterId: string;
  @IsDateString() issueDate: string;
  @IsDateString() validUntilDate: string;
  @IsString() @IsOptional() notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RequestForQuoteLineInputDto)
  lines: RequestForQuoteLineInputDto[];
}

export class SendRequestForQuoteDto {
  @IsArray() @ArrayMinSize(1) @IsUUID('all', { each: true })
  supplierIds: string[];
}

export class RfqQuoteLineCostDto {
  @IsUUID() rfqLineId: string;
  @IsInt() @Min(0) unitCostCents: number;
  @IsInt() @Min(0) @IsOptional() leadTimeDays?: number;
}

export class RecordSupplierQuoteDto {
  @IsUUID() supplierId: string;
  @IsInt() @Min(0) totalCents: number;
  @IsString() @Length(3, 3) @IsOptional() currency?: string;
  @IsDateString() @IsOptional() validUntilDate?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RfqQuoteLineCostDto)
  perLineCosts: RfqQuoteLineCostDto[];
  @IsString() @IsOptional() notes?: string;
}

export class AwardRfqDto {
  @IsUUID() quoteId: string;
}

export class ConvertRfqToPoDto {
  @IsDateString() orderDate: string;
  @IsDateString() @IsOptional() expectedDeliveryDate?: string;
  @IsUUID() @IsOptional() shipToWarehouseId?: string;
  @IsString()
  @Length(3, 3)
  @IsIn([
    'EXW',
    'FCA',
    'CPT',
    'CIP',
    'DAP',
    'DPU',
    'DDP',
    'FAS',
    'FOB',
    'CFR',
    'CIF',
  ])
  @IsOptional()
  shippingTermsIncoterms?: string;
  @IsInt() @Min(0) @IsOptional() paymentTermsDays?: number;
}

// --- GoodsReceipt DTOs (S14.1) --------------------------------------------

export class GoodsReceiptLineInputDto {
  @IsUUID() poLineId: string;
  @IsUUID() productId: string;
  @IsNumberString() receivedQuantity: string;
  @IsNumberString() @IsOptional() acceptedQuantity?: string;
  @IsNumberString() @IsOptional() rejectedQuantity?: string;
  @IsString() @IsOptional() rejectReason?: string;
  @IsUUID() @IsOptional() lotId?: string;
  @IsArray() @IsOptional() serialIds?: string[];
  @IsString() @Length(1, 50) @IsOptional() warehouseLocation?: string;
}

export class CreateGoodsReceiptDto {
  @IsUUID() poId: string;
  @IsUUID() supplierId: string;
  @IsUUID() warehouseId: string;
  @IsDateString() receiptDate: string;
  @IsUUID() receivedBy: string;
  @IsString() @Length(1, 100) @IsOptional() carrierTrackingNumber?: string;
  @IsString() @Length(1, 100) @IsOptional() supplierDdtNumber?: string;
  @IsDateString() @IsOptional() supplierDdtDate?: string;
  @IsString() @IsOptional() notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineInputDto)
  lines: GoodsReceiptLineInputDto[];
}

export class InspectGoodsReceiptLineDto {
  @IsUUID() goodsReceiptLineId: string;
  @IsNumberString() acceptedQuantity: string;
  @IsNumberString() rejectedQuantity: string;
  @IsString() @IsOptional() rejectReason?: string;
  @IsUUID() @IsOptional() inspectionId?: string;
}

export class InspectGoodsReceiptDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InspectGoodsReceiptLineDto)
  lines: InspectGoodsReceiptLineDto[];
}

// --- SupplierInvoice DTOs (S14.2) -----------------------------------------

export class SupplierInvoiceLineInputDto {
  @IsString() @Length(1, 500) description: string;
  @IsNumberString() quantity: string;
  @IsString() @Length(1, 20) @IsOptional() unitOfMeasure?: string;
  @IsInt() @Min(0) unitCostCents: number;
  @IsInt() @Min(0) lineTotalCents: number;
  @IsInt() @Min(0) @Max(99) @IsOptional() taxRate?: number;
  @IsInt() @Min(0) @IsOptional() taxAmountCents?: number;
  @IsString() @Length(1, 10) @IsOptional() naturaCode?: string;
  @IsUUID() @IsOptional() poLineId?: string;
  @IsString() @IsOptional() notes?: string;
}

export class IvaBreakdownItemDto {
  @IsInt() @Min(0) @Max(99) rate: number;
  @IsInt() @Min(0) taxableCents: number;
  @IsInt() @Min(0) taxCents: number;
  @IsString() @Length(1, 10) @IsOptional() naturaCode?: string;
}

export class CreateSupplierInvoiceDto {
  @IsUUID() supplierId: string;
  @IsString() @Length(1, 50) supplierInvoiceNumber: string;
  @IsDateString() supplierInvoiceDate: string;
  @IsDateString() @IsOptional() receivedDate?: string;
  @IsString() @IsIn(['pec', 'manual', 'ocr', 'sdi']) @IsOptional()
  receivedVia?: 'pec' | 'manual' | 'ocr' | 'sdi';
  @IsString() @Length(1, 255) @IsOptional() externalMessageId?: string;
  @IsString() @Length(1, 500) @IsOptional() fatturaPaXmlPath?: string;
  @IsInt() @Min(0) subtotalCents: number;
  @IsInt() @Min(0) taxCents: number;
  @IsInt() @Min(0) totalCents: number;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IvaBreakdownItemDto)
  @IsOptional()
  ivaBreakdown?: IvaBreakdownItemDto[];
  @IsDateString() paymentDueDate: string;
  @IsInt() @Min(0) @IsOptional() paymentTermsDays?: number;
  @IsArray() @IsUUID('all', { each: true }) @IsOptional() poIds?: string[];
  @IsString() @IsOptional() notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupplierInvoiceLineInputDto)
  lines: SupplierInvoiceLineInputDto[];
}

export class RunMatchDto {
  @IsInt() @Min(0) @Max(100) @IsOptional() quantityPct?: number;
  @IsInt() @Min(0) @Max(100) @IsOptional() pricePct?: number;
  @IsInt() @Min(0) @Max(100) @IsOptional() totalPct?: number;
}

export class ApproveSupplierInvoiceDto {
  @IsUUID() approverUserId: string;
}

export class DisputeSupplierInvoiceDto {
  @IsString() reason: string;
}

