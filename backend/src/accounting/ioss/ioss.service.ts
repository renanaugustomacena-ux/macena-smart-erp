import { BadRequestException, Injectable } from '@nestjs/common';

/**
 * IOSS (Import One-Stop Shop) helper (plan §31.3 Sprint 43).
 *
 * EU Reg. 2017/2455 + 2019/2026: IOSS lets a non-EU seller declare +
 * remit VAT on B2C imports ≤ €150 in a single monthly return through a
 * single Member State. Italian intermediaries register on the AdE
 * "OSS" portal and the seller's IOSS number prefixes outbound shipments.
 *
 * v1 ships the validation + the per-tenant IOSS number storage surface;
 * the full monthly-return generator lands alongside the Sprint 60 FR
 * roll-out (where IOSS adoption is highest).
 */
export interface IossInvoiceCheck {
  iossNumberValid: boolean;
  thresholdRespected: boolean;
  warnings: string[];
}

@Injectable()
export class IossService {
  /**
   * IOSS number format: `IM` + 10 digits + 2 check chars (`IMxxxxxxxxxxxx`).
   * Reference: Reg. UE 2019/2026 art. 369o.
   */
  static readonly IOSS_NUMBER_PATTERN = /^IM\d{10}\w{2}$/;
  static readonly IOSS_THRESHOLD_CENTS = 15_000;

  validate(iossNumber: string): boolean {
    return IossService.IOSS_NUMBER_PATTERN.test(iossNumber.trim());
  }

  checkInvoice(input: {
    iossNumber: string | null;
    consigneeCountry: string;
    consignmentValueCents: number;
    isB2C: boolean;
  }): IossInvoiceCheck {
    const warnings: string[] = [];
    if (!input.isB2C) {
      warnings.push(
        'IOSS does not apply to B2B sales — apply the standard intra-EU regime instead.',
      );
    }
    const thresholdRespected =
      input.consignmentValueCents <= IossService.IOSS_THRESHOLD_CENTS;
    if (!thresholdRespected) {
      warnings.push(
        `Consignment value ${(input.consignmentValueCents / 100).toFixed(2)} EUR > €150 threshold — IOSS not applicable; standard import regime applies.`,
      );
    }
    const iossValid = input.iossNumber
      ? this.validate(input.iossNumber)
      : false;
    if (input.iossNumber && !iossValid) {
      warnings.push(
        'IOSS number does not match the IM-prefix + 12-char shape (Reg. UE 2019/2026 art. 369o).',
      );
    }
    return {
      iossNumberValid: iossValid,
      thresholdRespected,
      warnings,
    };
  }

  /**
   * Convert a foreign-currency amount to EUR cents using the supplied
   * (typically AdE-published) exchange rate. The bank-of-Italy
   * monthly rate (`cambi.bancaditalia.it`) is the canonical source for
   * Italian fiscal conversions; v1 takes the rate as input + the live
   * fetcher lands alongside the Sprint 56 ES roll-out.
   */
  convertToEurCents(amountForeignCents: number, exchangeRate: number): number {
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      throw new BadRequestException(
        'exchangeRate must be a positive finite number',
      );
    }
    return Math.round(amountForeignCents / exchangeRate);
  }
}
