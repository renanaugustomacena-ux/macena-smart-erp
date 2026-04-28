/**
 * Canonical queue identifiers. Kept in a single file so that producers,
 * processors and monitoring dashboards agree on the exact Redis key.
 */
export const PAYROLL_BATCH_QUEUE = 'payroll-batch';
export const END_OF_DAY_QUEUE = 'end-of-day';
export const REPORT_GENERATION_QUEUE = 'report-generation';
export const INVOICE_SDI_QUEUE = 'invoice-sdi';
export const PEC_INGEST_QUEUE = 'pec-ingest';

export type PayrollBatchJobName = 'compute-monthly' | 'compute-thirteenth';
export type EndOfDayJobName = 'close-day' | 'reconcile-stock';
export type ReportJobName = 'iva-liquidation' | 'sales-by-customer' | 'stock-status';
export type InvoiceSdiJobName = 'submit' | 'poll-receipt';
export type PecIngestJobName = 'poll-mailbox';
