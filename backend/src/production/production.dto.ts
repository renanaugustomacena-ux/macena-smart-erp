import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  Priority,
  ProductionOrderStatus,
  WorkOrderStatus,
} from './production.service';

export class BomLineDto {
  @IsString()
  materialId!: string;

  @IsString()
  materialName!: string;

  @IsNumber()
  @Min(0)
  quantityRequired!: number;

  @IsString()
  unit!: string;
}

export class CreateProductionOrderDto {
  @ApiProperty()
  @IsString()
  @Length(1, 255)
  productName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(0)
  quantityPlanned!: number;

  @ApiProperty({ enum: Priority, required: false })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiProperty({ example: '2026-05-01' })
  @IsDateString()
  plannedStartDate!: string;

  @ApiProperty({ example: '2026-05-15' })
  @IsDateString()
  plannedEndDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerReference?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @ApiProperty({ required: false, type: [BomLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BomLineDto)
  billOfMaterials?: BomLineDto[];
}

export class CreateWorkOrderDto {
  @ApiProperty()
  @IsString()
  @Length(1, 255)
  operationName!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 100)
  workCenter!: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sequenceNumber!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedDurationHours?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  instructions?: string;
}

export class UpdateWorkOrderStatusDto {
  @ApiProperty({ enum: WorkOrderStatus })
  @IsEnum(WorkOrderStatus)
  status!: WorkOrderStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  quantityProduced?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  quantityRejected?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  qualityChecks?: {
    checkName: string;
    passed: boolean;
    value?: string;
  }[];
}

export class UpdateProductionOrderStatusDto {
  @ApiProperty({ enum: ProductionOrderStatus })
  @IsEnum(ProductionOrderStatus)
  status!: ProductionOrderStatus;
}
