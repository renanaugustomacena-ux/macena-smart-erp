import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ProductCategory,
  StockMovementType,
  UnitOfMeasure,
} from './inventory.entity';

export class CreateProductDto {
  @ApiProperty({ example: 'MAT-001' })
  @IsString()
  @Length(1, 50)
  sku!: string;

  @ApiProperty({ example: 'Acciaio Inox 304' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: ProductCategory })
  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @ApiProperty({ enum: UnitOfMeasure, required: false })
  @IsOptional()
  @IsEnum(UnitOfMeasure)
  unitOfMeasure?: UnitOfMeasure;

  @ApiProperty({ required: false, example: 3.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiProperty({ required: false, example: 5.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  barcode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  minimumStock?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  reorderQuantity?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplier?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class WarehouseZoneDto {
  @IsString() name!: string;
  @IsString() code!: string;
  @IsString() type!: string;
}

export class CreateWarehouseDto {
  @ApiProperty({ example: 'MAG-01' })
  @IsString()
  @Length(1, 20)
  code!: string;

  @ApiProperty({ example: 'Magazzino Principale Mozzecane' })
  @IsString()
  @Length(1, 255)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiProperty({ required: false, example: '37060' })
  @IsOptional()
  @IsString()
  @Length(5, 5)
  postalCode?: string;

  @ApiProperty({ required: false, example: 'VR' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  province?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactPerson?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacitySquareMeters?: number;

  @ApiProperty({ required: false, type: [WarehouseZoneDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WarehouseZoneDto)
  zones?: WarehouseZoneDto[];
}

export class StockMovementCreateDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  movementType!: StockMovementType;

  @ApiProperty({ example: 500 })
  @IsNumber()
  quantity!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  sourceWarehouseId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  destinationWarehouseId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  performedBy?: string;
}

export class UpdateProductDto extends CreateProductDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
