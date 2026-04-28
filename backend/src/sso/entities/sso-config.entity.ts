import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { DataClassification } from '../../common/data-classification.decorator';

/**
 * Per-tenant SSO configuration (plan §31.1 Sprint 22 / S22.5).
 *
 * Two protocols supported in v1:
 *   - SAML 2.0: external IdP signs SAML responses with the IdP cert;
 *     SmartERP validates the signature + extracts the principal.
 *   - SCIM 2.0: external IdP (Okta / Azure AD / Google) provisions
 *     user accounts via the SCIM endpoints (S22.3).
 *
 * Passport-saml integration (S22.1) is wired through `SamlStrategy` —
 * a thin Passport adapter that defers to this config table at request
 * time and validates the signed SAMLResponse against the stored cert.
 */
export type SsoProtocol = 'saml2' | 'scim2';
export type SsoStatus = 'active' | 'paused' | 'pending';

@Entity('sso_configs')
@Index(['tenantId', 'protocol'], { unique: true })
@Index(['tenantId', 'status'])
export class SsoConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column({
    type: 'enum',
    enum: ['saml2', 'scim2'],
  })
  protocol: SsoProtocol;

  @Column({
    type: 'enum',
    enum: ['active', 'paused', 'pending'],
    default: 'pending',
  })
  status: SsoStatus;

  // ─── SAML 2.0 fields ────────────────────────────────────

  @Column({ length: 1000, nullable: true })
  @DataClassification('confidential')
  idpEntityId: string | null;

  @Column({ length: 1000, nullable: true })
  @DataClassification('confidential')
  idpSsoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  @DataClassification('confidential')
  idpX509Cert: string | null;

  @Column({ length: 100, nullable: true })
  @DataClassification('confidential')
  attributeMappingEmail: string | null;

  @Column({ length: 100, nullable: true })
  @DataClassification('confidential')
  attributeMappingName: string | null;

  /** Default SmartERP role assigned to JIT-provisioned users. */
  @Column({ length: 50, default: 'viewer' })
  defaultRole: string;

  // ─── SCIM 2.0 fields ────────────────────────────────────

  /** SCIM bearer token (sha-256 of the value the IdP holds). */
  @Column({ length: 200, nullable: true })
  @DataClassification('restricted')
  scimBearerTokenHash: string | null;

  // ─── Break-glass admin (S22.6) ──────────────────────────

  /**
   * Email address that can always log in via the local password flow,
   * even when SSO is `active`. Used when the IdP is down or the SSO
   * configuration is misconfigured. The break-glass account is heavily
   * audited and rotated monthly per the Compliance runbook (§20.4).
   */
  @Column({ length: 255, nullable: true })
  @DataClassification('confidential')
  breakGlassEmail: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  breakGlassRotatedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
