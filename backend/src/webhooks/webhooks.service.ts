import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import {
  WebhookSubscription,
  WebhookSubscriptionStatus,
} from './entities/webhook-subscription.entity';
import { WebhookDlqEntry } from './entities/webhook-dlq-entry.entity';

/**
 * WebhooksService — REST surface over WebhookSubscription
 * (plan §31.1 Sprint 21 / S21.1).
 *
 * The live dispatcher worker (S21.2) consumes the existing outbox via
 * the Sprint 14 dispatcher; this service handles the management API.
 */
@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly subRepo: Repository<WebhookSubscription>,
    @InjectRepository(WebhookDlqEntry)
    private readonly dlqRepo: Repository<WebhookDlqEntry>,
  ) {}

  async create(
    tenantId: string,
    dto: { eventType: string; targetUrl: string; hmacSecret?: string },
  ): Promise<{ subscription: WebhookSubscription; secret: string }> {
    if (!/^https:\/\//i.test(dto.targetUrl)) {
      throw new ConflictException(
        'Webhook target URL must use HTTPS (no plaintext webhooks)',
      );
    }
    const secret = dto.hmacSecret ?? crypto.randomBytes(32).toString('hex');
    const entity = this.subRepo.create({
      tenantId,
      eventType: dto.eventType,
      targetUrl: dto.targetUrl,
      hmacSecret: secret,
      status: 'active',
    });
    const saved = await this.subRepo.save(entity);
    // Return the plaintext secret once — the caller stores it.
    return { subscription: saved, secret };
  }

  async list(
    tenantId: string,
    filters: {
      status?: WebhookSubscriptionStatus;
      eventType?: string;
    } = {},
  ): Promise<WebhookSubscription[]> {
    const qb = this.subRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId });
    if (filters.status)
      qb.andWhere('s.status = :status', { status: filters.status });
    if (filters.eventType)
      qb.andWhere('s.eventType = :eventType', { eventType: filters.eventType });
    return qb.orderBy('s.createdAt', 'DESC').getMany();
  }

  async pause(tenantId: string, id: string): Promise<WebhookSubscription> {
    const s = await this.getById(tenantId, id);
    s.status = 'paused';
    return this.subRepo.save(s);
  }

  async resume(tenantId: string, id: string): Promise<WebhookSubscription> {
    const s = await this.getById(tenantId, id);
    s.status = 'active';
    s.disabledAt = null;
    s.disabledReason = null;
    return this.subRepo.save(s);
  }

  async disable(
    tenantId: string,
    id: string,
    reason: string,
  ): Promise<WebhookSubscription> {
    const s = await this.getById(tenantId, id);
    s.status = 'disabled';
    s.disabledReason = reason;
    s.disabledAt = new Date();
    return this.subRepo.save(s);
  }

  async listDlq(
    tenantId: string,
    filters: { subscriptionId?: string; limit?: number } = {},
  ): Promise<WebhookDlqEntry[]> {
    const qb = this.dlqRepo
      .createQueryBuilder('d')
      .where('d.tenantId = :tenantId', { tenantId });
    if (filters.subscriptionId)
      qb.andWhere('d.subscriptionId = :sub', { sub: filters.subscriptionId });
    return qb
      .orderBy('d.createdAt', 'DESC')
      .limit(filters.limit ?? 200)
      .getMany();
  }

  // ─── Helpers ─────────────────────────────────────────────

  private async getById(
    tenantId: string,
    id: string,
  ): Promise<WebhookSubscription> {
    const s = await this.subRepo.findOne({ where: { tenantId, id } });
    if (!s) throw new NotFoundException(`Webhook subscription ${id} not found`);
    return s;
  }
}
