import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Quotation DTOs (S15.1) ─────────────────────────────────────

export class QuotationLineInputDto {
  @IsUUID() @IsOptional() productId?: string;
  @IsString() @Length(1, 500) description: string;
  @IsNumberString() quantity: string;
  @IsString() @Length(1, 20) @IsOptional() unitOfMeasure?: string;
  @IsInt() @Min(0) unitPriceCents: number;
  @IsNumberString() @IsOptional() discountPct?: string;
  @IsInt() @Min(0) @Max(99) @IsOptional() taxRate?: number;
}

export class CreateQuotationDto {
  @IsUUID() customerId: string;
  @IsDateString() issueDate: string;
  @IsDateString() validUntilDate: string;
  @IsString() @Length(3, 3) @IsOptional() currency?: string;
  @IsString() @IsOptional() notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuotationLineInputDto)
  lines: QuotationLineInputDto[];
}

export class ReviseQuotationDto {
  @IsString() @IsOptional() note?: string;
}

export class AcceptQuotationDto {
  @IsString() @IsOptional() note?: string;
}

export class RejectQuotationDto {
  @IsString() reason: string;
}

// ─── DDT DTOs (S15.2) ───────────────────────────────────────────

const DDT_CAUSALI = [
  'vendita',
  'conto_visione',
  'conto_lavorazione',
  'reso',
  'tentata_vendita',
  'campionatura',
  'altro',
] as const;

export class DdtLineInputDto {
  @IsUUID() productId: string;
  @IsUUID() @IsOptional() salesOrderLineId?: string;
  @IsString() @Length(1, 500) description: string;
  @IsNumberString() quantity: string;
  @IsString() @Length(1, 20) @IsOptional() unitOfMeasure?: string;
  @IsArray() @IsString({ each: true }) @IsOptional() serialIds?: string[];
  @IsUUID() @IsOptional() lotId?: string;
}

export class CreateDdtDto {
  @IsUUID() customerId: string;
  @IsUUID() @IsOptional() salesOrderId?: string;
  @IsDateString() issueDate: string;
  @IsString() @IsIn(DDT_CAUSALI) @IsOptional() causaleTrasporto?: typeof DDT_CAUSALI[number];
  @IsUUID() @IsOptional() carrierId?: string;
  @IsInt() @Min(1) @IsOptional() packageCount?: number;
  @IsNumberString() @IsOptional() totalWeightKg?: string;
  @IsObject() @IsOptional() shipFromAddress?: Record<string, unknown>;
  @IsObject() @IsOptional() shipToAddress?: Record<string, unknown>;
  @IsString() @IsOptional() notes?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DdtLineInputDto)
  lines: DdtLineInputDto[];
}

export class IssueDdtDto {
  @IsUUID() @IsOptional() carrierId?: string;
  @IsString() @Length(1, 100) @IsOptional() trackingNumber?: string;
}

export class MarkInTransitDdtDto {
  @IsString() @Length(1, 100) @IsOptional() trackingNumber?: string;
  @IsDateString() @IsOptional() shippedAt?: string;
}

export class MarkDeliveredDdtDto {
  @IsDateString() @IsOptional() deliveredAt?: string;
}

// ─── ContactActivity DTOs (S15.3) ───────────────────────────────

const ACTIVITY_KINDS = ['call', 'email', 'meeting', 'demo', 'visit', 'note'] as const;
const ACTIVITY_DIRECTIONS = ['inbound', 'outbound', 'internal'] as const;
const ACTIVITY_LINKED_TYPES = [
  'customer',
  'quotation',
  'sales_order',
  'invoice',
  'ddt',
  'rfq',
  'complaint',
] as const;

export class CreateContactActivityDto {
  @IsUUID() customerId: string;
  @IsUUID() @IsOptional() contactPersonId?: string;
  @IsString() @IsIn(ACTIVITY_KINDS) kind: typeof ACTIVITY_KINDS[number];
  @IsString() @IsIn(ACTIVITY_DIRECTIONS) @IsOptional()
  direction?: typeof ACTIVITY_DIRECTIONS[number];
  @IsDateString() occurredAt: string;
  @IsInt() @Min(0) @IsOptional() durationMinutes?: number;
  @IsString() @Length(1, 200) subject: string;
  @IsString() @IsOptional() body?: string;
  @IsString() @IsIn(ACTIVITY_LINKED_TYPES) @IsOptional()
  linkedEntityType?: typeof ACTIVITY_LINKED_TYPES[number];
  @IsUUID() @IsOptional() linkedEntityId?: string;
  @IsUUID() recordedBy: string;
  @IsArray() @IsString({ each: true }) @IsOptional() tags?: string[];
}

export class ListContactActivityQueryDto {
  @IsUUID() @IsOptional() customerId?: string;
  @IsString() @IsIn(ACTIVITY_KINDS) @IsOptional()
  kind?: typeof ACTIVITY_KINDS[number];
  @IsString() @IsIn(ACTIVITY_LINKED_TYPES) @IsOptional()
  linkedEntityType?: typeof ACTIVITY_LINKED_TYPES[number];
  @IsUUID() @IsOptional() linkedEntityId?: string;
  @IsInt() @Min(1) @Max(500) @IsOptional() limit?: number;
}
