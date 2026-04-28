import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConservazioneAdapter,
  ConservazioneVendorId,
  VersamentoReceipt,
  VersamentoRequest,
} from './conservazione.adapter';
import { ConservazioneRegistry } from './conservazione-registry.service';
import {
  SubscriptionPlan,
  Tenant,
} from '../tenants/tenant.entity';

/**
 * ConservazioneOrchestrator — tier-aware façade in front of the
 * `ConservazioneRegistry` (ADR-016 + ADR-025).
 *
 * Plan §31.1 Sprint 16 / S16.4. Responsibilities:
 *
 *   1. Resolve per-tenant configuration:
 *        - `tenant.settings.conservazione.primary`
 *        - `tenant.settings.conservazione.secondary` (allowed only at
 *          Professionale+ per ADR-025)
 *        - `tenant.settings.conservazione.tertiary` (Enterprise only)
 *
 *   2. Validate the configuration against the tier policy. Illegal
 *      combinations are rejected with `UnprocessableEntityException`
 *      (RFC 7807 422 via the platform's ProblemDetails filter).
 *
 *   3. Submit `versamento` calls in primary → secondary → tertiary order.
 *      Failover triggers only on *transient* primary failure (5xx /
 *      network / timeout). 4xx errors abort immediately (the input
 *      payload itself is wrong; failover would burn a second-vendor
 *      quota on the same broken document).
 *
 *   4. Tag the resulting `VersamentoReceipt` with `failoverFrom` so
 *      the call site can surface a UI badge and an audit log entry.
 */
export interface OrchestratedReceipt extends VersamentoReceipt {
  failoverFrom: ConservazioneVendorId | null;
  tierPolicy: 'single' | 'dual' | 'triple';
}

interface ResolvedConfig {
  primary: ConservazioneVendorId;
  secondary: ConservazioneVendorId | null;
  tertiary: ConservazioneVendorId | null;
  policy: 'single' | 'dual' | 'triple';
}

const TRANSIENT_HTTP_RX = /5\d{2}|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH/i;

@Injectable()
export class ConservazioneOrchestrator {
  private readonly logger = new Logger(ConservazioneOrchestrator.name);

  constructor(
    private readonly registry: ConservazioneRegistry,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async submit(request: VersamentoRequest): Promise<OrchestratedReceipt> {
    const config = await this.resolveConfig(request.tenantId);
    return this.submitWithConfig(request, config);
  }

  /**
   * Validate a candidate `tenant.settings.conservazione.*` blob against
   * the tier policy. Used by the tenant-settings save endpoint to fail
   * fast, before a real versamento is attempted.
   */
  validateForTier(
    plan: SubscriptionPlan,
    settings: {
      primary?: ConservazioneVendorId;
      secondary?: ConservazioneVendorId | null;
      tertiary?: ConservazioneVendorId | null;
    },
  ): void {
    if (!settings.primary) {
      throw new UnprocessableEntityException(
        'A primary Conservatore must be configured for every tenant',
      );
    }
    this.assertVendorRegistered(settings.primary);

    const has = (v: unknown) => typeof v === 'string' && v.length > 0;

    if (plan === SubscriptionPlan.BASE) {
      if (has(settings.secondary) || has(settings.tertiary)) {
        throw new UnprocessableEntityException(
          'Base tier does not allow a secondary or tertiary Conservatore (ADR-025); upgrade the tenant to Professionale or higher to enable dual-vendor.',
        );
      }
    }

    if (
      plan === SubscriptionPlan.PROFESSIONALE &&
      has(settings.tertiary)
    ) {
      throw new UnprocessableEntityException(
        'Tertiary Conservatore is reserved for the Enterprise tier (ADR-025)',
      );
    }

    if (settings.secondary) {
      this.assertVendorRegistered(settings.secondary);
      if (settings.secondary === settings.primary) {
        throw new UnprocessableEntityException(
          'Secondary Conservatore must differ from primary',
        );
      }
    }
    if (settings.tertiary) {
      this.assertVendorRegistered(settings.tertiary);
      if (
        settings.tertiary === settings.primary ||
        settings.tertiary === settings.secondary
      ) {
        throw new UnprocessableEntityException(
          'Tertiary Conservatore must differ from primary and secondary',
        );
      }
    }
  }

  // ─── Implementation ────────────────────────────────────────

  async resolveConfig(tenantId: string): Promise<ResolvedConfig> {
    // Lookup is by primary key (the tenants table is the tenant axis itself).
    // eslint-disable-next-line no-untenanted-query
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new UnprocessableEntityException(
        `No Tenant ${tenantId} for Conservazione lookup`,
      );
    }
    const blob = (tenant.settings ?? {}) as Record<string, unknown>;
    const conservazione =
      typeof blob.conservazione === 'object' && blob.conservazione !== null
        ? (blob.conservazione as Record<string, unknown>)
        : {};
    const primary = (conservazione.primary as ConservazioneVendorId) ?? 'aruba';
    const secondaryRaw = conservazione.secondary as
      | ConservazioneVendorId
      | null
      | undefined;
    const tertiaryRaw = conservazione.tertiary as
      | ConservazioneVendorId
      | null
      | undefined;

    this.validateForTier(tenant.plan, {
      primary,
      secondary: secondaryRaw ?? null,
      tertiary: tertiaryRaw ?? null,
    });

    const policy: ResolvedConfig['policy'] = tertiaryRaw
      ? 'triple'
      : secondaryRaw
        ? 'dual'
        : 'single';

    return {
      primary,
      secondary: secondaryRaw ?? null,
      tertiary: tertiaryRaw ?? null,
      policy,
    };
  }

  private async submitWithConfig(
    request: VersamentoRequest,
    config: ResolvedConfig,
  ): Promise<OrchestratedReceipt> {
    const primaryAdapter = this.registry.get(config.primary);

    try {
      const receipt = await primaryAdapter.send(request);
      return this.tag(receipt, null, config.policy);
    } catch (err) {
      if (!isTransient(err)) {
        throw err;
      }
      if (!config.secondary) {
        // Single-vendor or non-recoverable: surface the original error.
        throw err;
      }
      this.logger.warn({
        event: 'conservazione.failover',
        from: config.primary,
        to: config.secondary,
        reason: messageOf(err),
      });
      const secondary = this.registry.get(config.secondary);
      try {
        const receipt = await secondary.send(request);
        return this.tag(receipt, config.primary, config.policy);
      } catch (errSecondary) {
        if (!config.tertiary || !isTransient(errSecondary)) {
          throw errSecondary;
        }
        this.logger.warn({
          event: 'conservazione.failover.tertiary',
          from: config.secondary,
          to: config.tertiary,
          reason: messageOf(errSecondary),
        });
        const tertiary = this.registry.get(config.tertiary);
        const receipt = await tertiary.send(request);
        return this.tag(receipt, config.secondary, config.policy);
      }
    }
  }

  private tag(
    receipt: VersamentoReceipt,
    failoverFrom: ConservazioneVendorId | null,
    policy: ResolvedConfig['policy'],
  ): OrchestratedReceipt {
    return { ...receipt, failoverFrom, tierPolicy: policy };
  }

  private assertVendorRegistered(vendor: ConservazioneVendorId): void {
    // Will throw NotFoundException if the vendor adapter is not wired.
    this.registry.get(vendor) as ConservazioneAdapter;
  }
}

function isTransient(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = messageOf(err);
  if (TRANSIENT_HTTP_RX.test(msg)) return true;
  const status = (err as { status?: number; statusCode?: number }).status
    ?? (err as { statusCode?: number }).statusCode;
  if (typeof status === 'number' && status >= 500) return true;
  return false;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}
