import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { SubscriptionPlan, TenantStatus } from './tenant.entity';

export class CreateTenantDto {
  @ApiProperty({ example: 'Fonderia Mozzecane SRL' })
  @IsString()
  @Length(1, 255)
  name!: string;

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
  @IsString()
  pecEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  billingCity?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(5, 5)
  billingPostalCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  billingProvince?: string;

  @ApiProperty({ enum: SubscriptionPlan, required: false })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class UpdateTenantDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ enum: SubscriptionPlan, required: false })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @ApiProperty({ enum: TenantStatus, required: false })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(-1)
  seatLimit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
