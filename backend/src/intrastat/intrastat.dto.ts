import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  IntrastatDeclarationStatus,
  IntrastatDeclarationType,
} from './entities/intrastat-declaration.entity';

const TYPES: IntrastatDeclarationType[] = ['cessioni', 'acquisti'];

export class CreateDraftDeclarationDto {
  @IsIn(TYPES)
  type: IntrastatDeclarationType;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;
}

export class SubmitDeclarationDto {
  @IsString()
  @Length(1, 50)
  admProtocollo: string;
}

export class RejectDeclarationDto {
  @IsString()
  @Length(1, 1000)
  reason: string;
}

const STATUSES: IntrastatDeclarationStatus[] = [
  'draft',
  'generated',
  'submitted',
  'accepted',
  'rejected',
];

export class ListDeclarationsQueryDto {
  @IsOptional()
  @IsIn(TYPES)
  type?: IntrastatDeclarationType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsIn(STATUSES)
  status?: IntrastatDeclarationStatus;
}
