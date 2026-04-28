import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BankAccount,
  BankAccountStatus,
  BankTransaction,
  Psd2Provider,
} from './entities/bank-account.entity';
import {
  decryptIban,
  encryptIban,
  maskIban,
  validateIban,
} from './iban.util';
import { IntesaPsd2Adapter } from './psd2/intesa.adapter';
import { UnicreditPsd2Adapter } from './psd2/unicredit.adapter';
import { BperPsd2Adapter } from './psd2/bper.adapter';
import { Psd2Adapter } from './psd2/psd2.adapter';

@Injectable()
export class TreasuryService {
  constructor(
    @InjectRepository(BankAccount)
    private readonly accountRepo: Repository<BankAccount>,
    @InjectRepository(BankTransaction)
    private readonly txRepo: Repository<BankTransaction>,
    private readonly intesa: IntesaPsd2Adapter,
    private readonly unicredit: UnicreditPsd2Adapter,
    private readonly bper: BperPsd2Adapter,
  ) {}

  // ─── BankAccount CRUD ──────────────────────────────────

  async createAccount(
    tenantId: string,
    dto: {
      name: string;
      iban: string;
      bicSwift?: string;
      bankName?: string;
      psd2Provider?: Psd2Provider;
      currency?: string;
    },
  ): Promise<BankAccount> {
    if (!validateIban(dto.iban)) {
      throw new BadRequestException('Invalid IBAN (mod-97 / format check failed)');
    }
    const ibanCleaned = dto.iban.replace(/\s+/g, '').toUpperCase();
    const entity = this.accountRepo.create({
      tenantId,
      name: dto.name,
      ibanEncrypted: encryptIban(ibanCleaned),
      ibanMasked: maskIban(ibanCleaned),
      bicSwift: dto.bicSwift ?? null,
      bankName: dto.bankName ?? null,
      currency: dto.currency ?? 'EUR',
      psd2Provider: dto.psd2Provider ?? 'manual',
      status: 'active',
    });
    return this.accountRepo.save(entity);
  }

  async listAccounts(
    tenantId: string,
    filters: { status?: BankAccountStatus } = {},
  ): Promise<BankAccount[]> {
    const qb = this.accountRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId });
    if (filters.status) qb.andWhere('a.status = :status', { status: filters.status });
    return qb.orderBy('a.name', 'ASC').getMany();
  }

  async getAccount(tenantId: string, id: string): Promise<BankAccount> {
    const a = await this.accountRepo.findOne({ where: { tenantId, id } });
    if (!a) throw new NotFoundException(`BankAccount ${id} not found`);
    return a;
  }

  /** Return the plaintext IBAN — restricted; only for outbound payment files. */
  async revealIban(tenantId: string, id: string): Promise<string> {
    const a = await this.getAccount(tenantId, id);
    return decryptIban(a.ibanEncrypted);
  }

  // ─── PSD2 sync ────────────────────────────────────────

  async syncPsd2(
    tenantId: string,
    accountId: string,
    mode: 'sandbox' | 'production' = 'sandbox',
  ): Promise<{ imported: number; cursor: string | null }> {
    const account = await this.getAccount(tenantId, accountId);
    if (account.psd2Provider === 'manual') {
      throw new BadRequestException(
        'Account has no PSD2 provider — set psd2Provider before syncing',
      );
    }
    const adapter = this.resolveAdapter(account.psd2Provider);
    const consent =
      (account.psd2Consent as unknown as {
        consentId: string;
        validUntil: string;
        scaStatus: 'received' | 'authenticated' | 'expired';
      } | null) ?? null;
    const ibanPlaintext = decryptIban(account.ibanEncrypted);
    const result = await adapter.pullTransactions(
      {
        tenantId,
        ibanPlaintext,
        consent,
        mode,
      },
      account.lastTransactionCursor,
    );
    let imported = 0;
    for (const tx of result.transactions) {
      // Idempotency by externalId — UNIQUE(tenantId, externalId).
      const existing = await this.txRepo.findOne({
        where: { tenantId, externalId: tx.externalId },
      });
      if (existing) continue;
      const entity = this.txRepo.create({
        tenantId,
        bankAccountId: account.id,
        externalId: tx.externalId,
        valueDate: new Date(tx.valueDate),
        bookingDate: new Date(tx.bookingDate),
        amountCents: tx.amountCents,
        currency: tx.currency,
        description: tx.description,
        counterpartyName: tx.counterpartyName,
        counterpartyIbanEncrypted: tx.counterpartyIban
          ? encryptIban(tx.counterpartyIban.replace(/\s+/g, '').toUpperCase())
          : null,
      });
      await this.txRepo.save(entity);
      imported += 1;
    }
    account.lastTransactionCursor = result.cursor;
    account.lastSyncedAt = new Date();
    await this.accountRepo.save(account);
    return { imported, cursor: result.cursor };
  }

  // ─── Reconciliation ───────────────────────────────────

  async listUnmatched(
    tenantId: string,
    accountId?: string,
  ): Promise<BankTransaction[]> {
    const qb = this.txRepo
      .createQueryBuilder('t')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.reconciliationStatus = :st', { st: 'unmatched' });
    if (accountId) qb.andWhere('t.bankAccountId = :acc', { acc: accountId });
    return qb.orderBy('t.valueDate', 'DESC').limit(500).getMany();
  }

  async manualMatch(
    tenantId: string,
    txId: string,
    actorUserId: string,
    body: { documentType: string; documentId: string },
  ): Promise<BankTransaction> {
    const tx = await this.txRepo.findOne({ where: { tenantId, id: txId } });
    if (!tx) throw new NotFoundException(`BankTransaction ${txId} not found`);
    tx.matchedDocumentType = body.documentType;
    tx.matchedDocumentId = body.documentId;
    tx.reconciliationStatus = 'matched';
    tx.matchedAt = new Date();
    tx.matchedBy = actorUserId;
    return this.txRepo.save(tx);
  }

  async ignore(
    tenantId: string,
    txId: string,
    actorUserId: string,
  ): Promise<BankTransaction> {
    const tx = await this.txRepo.findOne({ where: { tenantId, id: txId } });
    if (!tx) throw new NotFoundException(`BankTransaction ${txId} not found`);
    tx.reconciliationStatus = 'ignored';
    tx.matchedAt = new Date();
    tx.matchedBy = actorUserId;
    return this.txRepo.save(tx);
  }

  // ─── Helpers ──────────────────────────────────────────

  private resolveAdapter(provider: Psd2Provider): Psd2Adapter {
    switch (provider) {
      case 'intesa':
        return this.intesa;
      case 'unicredit':
        return this.unicredit;
      case 'bper':
        return this.bper;
      default:
        throw new BadRequestException(
          `PSD2 adapter for '${provider}' not yet wired`,
        );
    }
  }
}
