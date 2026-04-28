import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { SsoConfig, SsoProtocol } from './entities/sso-config.entity';

@Injectable()
export class SsoService {
  constructor(
    @InjectRepository(SsoConfig)
    private readonly ssoRepo: Repository<SsoConfig>,
  ) {}

  async upsert(
    tenantId: string,
    protocol: SsoProtocol,
    fields: Partial<SsoConfig>,
  ): Promise<SsoConfig> {
    const existing = await this.ssoRepo.findOne({
      where: { tenantId, protocol },
    });
    if (existing) {
      Object.assign(existing, fields);
      return this.ssoRepo.save(existing);
    }
    const fresh = this.ssoRepo.create({
      tenantId,
      protocol,
      status: 'pending',
      defaultRole: 'viewer',
      ...fields,
    });
    return this.ssoRepo.save(fresh);
  }

  async list(tenantId: string): Promise<SsoConfig[]> {
    return this.ssoRepo
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId })
      .orderBy('s.protocol', 'ASC')
      .getMany();
  }

  async activate(
    tenantId: string,
    protocol: SsoProtocol,
  ): Promise<SsoConfig> {
    const cfg = await this.getOrThrow(tenantId, protocol);
    cfg.status = 'active';
    return this.ssoRepo.save(cfg);
  }

  async pause(
    tenantId: string,
    protocol: SsoProtocol,
  ): Promise<SsoConfig> {
    const cfg = await this.getOrThrow(tenantId, protocol);
    cfg.status = 'paused';
    return this.ssoRepo.save(cfg);
  }

  /**
   * Issues a fresh SCIM bearer token for the tenant, returning the
   * plaintext value to the caller once. The hash is persisted; the
   * plaintext never leaves this method.
   */
  async rotateScimToken(
    tenantId: string,
  ): Promise<{ token: string; tokenHash: string }> {
    const cfg = await this.getOrThrow(tenantId, 'scim2');
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    cfg.scimBearerTokenHash = tokenHash;
    cfg.status = cfg.status === 'pending' ? 'active' : cfg.status;
    await this.ssoRepo.save(cfg);
    return { token, tokenHash };
  }

  /**
   * Verify an inbound SCIM bearer token by hashing + comparing to the
   * stored hash. Used by the SCIM controller's auth guard.
   */
  async verifyScimToken(
    tenantId: string,
    token: string,
  ): Promise<boolean> {
    const cfg = await this.ssoRepo.findOne({
      where: { tenantId, protocol: 'scim2' },
    });
    if (!cfg || !cfg.scimBearerTokenHash || cfg.status !== 'active') {
      return false;
    }
    const candidate = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    return safeEqual(candidate, cfg.scimBearerTokenHash);
  }

  /**
   * Set or rotate the break-glass admin (S22.6).
   */
  async setBreakGlass(
    tenantId: string,
    email: string,
  ): Promise<SsoConfig> {
    if (!email || !email.includes('@')) {
      throw new ConflictException('Invalid break-glass email');
    }
    // The break-glass record sits on whichever SSO config exists; if
    // none yet, create a placeholder SAML record.
    let cfg = await this.ssoRepo.findOne({
      where: { tenantId, protocol: 'saml2' },
    });
    if (!cfg) {
      cfg = this.ssoRepo.create({
        tenantId,
        protocol: 'saml2',
        status: 'pending',
        defaultRole: 'viewer',
      });
    }
    cfg.breakGlassEmail = email.trim().toLowerCase();
    cfg.breakGlassRotatedAt = new Date();
    return this.ssoRepo.save(cfg);
  }

  private async getOrThrow(
    tenantId: string,
    protocol: SsoProtocol,
  ): Promise<SsoConfig> {
    const cfg = await this.ssoRepo.findOne({
      where: { tenantId, protocol },
    });
    if (!cfg) throw new NotFoundException(`No ${protocol} SSO config`);
    return cfg;
  }
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) {
    r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return r === 0;
}
