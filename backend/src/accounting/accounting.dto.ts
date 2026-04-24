import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AccountType, InvoiceDocumentType } from './accounting.entity';

export class CreateAccountDto {
  @ApiProperty({ example: '04.01.001' })
  @IsString()
  @Length(1, 20)
  code!: string;

  @ApiProperty({ example: 'Ricavi vendita prodotti' })
  @IsString()
  @Length(1, 255)
  description!: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  type!: AccountType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isBankAccount?: boolean;
}

export class JournalLineDto {
  @IsString()
  accountId!: string;

  @IsString()
  accountCode!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  debit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  credit?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty()
  @IsString()
  reference!: string;

  @ApiProperty({ example: '2026-05-01' })
  @IsDateString()
  entryDate!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  journal?: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ type: [JournalLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class InvoiceLineDto {
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  ivaRate!: number;

  @IsOptional()
  @IsString()
  ivaNature?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ enum: InvoiceDocumentType, required: false })
  @IsOptional()
  @IsEnum(InvoiceDocumentType)
  documentType?: InvoiceDocumentType;

  @ApiProperty({ example: '2026-05-01' })
  @IsDateString()
  invoiceDate!: string;

  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty()
  @IsString()
  customerName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerVatNumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerFiscalCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerSdiCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerPecEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  salesOrderId?: string;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
