import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  PipelineFilters,
  PipelineStage,
} from './sales-pipeline.service';

const STAGE_VALUES: PipelineStage[] = [
  'lead',
  'qualifying',
  'negotiation',
  'won',
  'delivered',
  'lost',
];

/**
 * Query parameters for `GET /api/sales/pipeline`.
 *
 * `stage` accepts a comma-separated list (e.g., `?stage=qualifying,negotiation`)
 * or repeated query keys (`?stage=qualifying&stage=negotiation`); both are
 * normalised to a `PipelineStage[]`.
 */
export class PipelineQueryDto {
  @IsOptional()
  @Transform(({ value }) => normaliseStageList(value))
  @IsArray()
  @IsIn(STAGE_VALUES, { each: true })
  stage?: PipelineStage[];

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  customerCodeContains?: string;

  @IsOptional()
  @IsISO8601()
  periodFrom?: string;

  @IsOptional()
  @IsISO8601()
  periodTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minValueCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxValueCents?: number;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}

export function pipelineQueryDtoToFilters(
  q: PipelineQueryDto,
): PipelineFilters {
  return {
    stage: q.stage,
    customerId: q.customerId,
    customerCodeContains: q.customerCodeContains,
    periodFrom: q.periodFrom,
    periodTo: q.periodTo,
    minValueCents: q.minValueCents,
    maxValueCents: q.maxValueCents,
    ownerId: q.ownerId,
    currency: q.currency,
  };
}

function normaliseStageList(value: unknown): PipelineStage[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map(String) as PipelineStage[];
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0) as PipelineStage[];
  }
  return undefined;
}
