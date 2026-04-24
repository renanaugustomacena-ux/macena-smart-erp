import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CustomerType, SalesOrderStatus } from './sales.entity';

export class CreateCustomerDto {
  @ApiProperty({ example: 'C-0001' })
  @IsString()
  @Length(1, 50)
  code!: string;

  @ApiProperty({ example: 'Rossi Servizi SRL' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({ enum: CustomerType, required: false })
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;

  @ApiProperty({ required: false, example: '02345678901' })
  @IsOptional()
  @Matches(/^\d{11}$/, { message: 'vatNumber must be 11 numeric digits' })
  vatNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(11, 16)
  fiscalCode?: string;

  @ApiProperty({ required: false, example: '0000000' })
  @IsOptional()
  @Matches(/^[A-Z0-9]{7}$/, { message: 'sdiDestinationCode must be 7 alphanumeric uppercase' })
  sdiDestinationCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  pecEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(5, 5)
  postalCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  province?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiProperty({ required: false, example: 22 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  defaultIvaRate?: number;

  @ApiProperty({ required: false, example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  splitPayment?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  notes?: Record<string, unknown>;
}

export class SalesOrderLineDto {
  @IsString()
  productId!: string;

  @IsString()
  sku!: string;

  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  ivaRate!: number;

  @IsOptional()
  @IsString()
  warehouseId?: string;
}

export class CreateSalesOrderDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty({ example: '2026-05-01' })
  @IsDateString()
  orderDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  requestedDeliveryDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerPoReference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [SalesOrderLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderLineDto)
  lines!: SalesOrderLineDto[];
}

export class UpdateSalesOrderStatusDto {
  @ApiProperty({ enum: SalesOrderStatus })
  @IsEnum(SalesOrderStatus)
  status!: SalesOrderStatus;
}
