import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { renderMinimalPdf } from './pdf.renderer';

/**
 * ComplianceService — generates the NIS2 Compliance Pack
 * (plan §31.1 Sprint 20 / S20.1) and the per-tenant security pack
 * (S20.5). The pack is a self-contained PDF with the per-tenant
 * substantiations of every NIS2 D.Lgs. 138/2024 obligation that
 * applies to a "soggetto importante" SmartERP customer.
 */
@Injectable()
export class ComplianceService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async generateNis2Pack(
    tenantId: string,
  ): Promise<{ filename: string; body: Buffer; contentType: string }> {
    // Tenant lookup is by primary id — the tenant table is the
    // tenant-scope axis itself.
    // eslint-disable-next-line no-untenanted-query
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const auditCounts = await this.auditCountsLast30Days(tenantId);

    const lines: string[] = [
      `NIS2 Compliance Pack — ${tenant.name}`,
      `Tenant ID: ${tenant.id}`,
      `Plan: ${tenant.plan}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      'Riferimenti normativi',
      '  D.Lgs. 138/2024 — recepimento NIS2 (in vigore 17/10/2024)',
      '  Direttiva UE 2022/2555 — NIS2',
      '  Reg. UE 2016/679 (GDPR) + D.Lgs. 196/2003',
      '  ACN — autorita competente NIS2 in Italia',
      '',
      'Sezione 1 — Governance e gestione del rischio (art. 24)',
      '  Risk owner: titolare dell\'organizzazione (vedi anagrafica tenant).',
      '  Riesame del rischio almeno annuale; riesame straordinario su',
      '  incidenti significativi entro 30 giorni.',
      '',
      'Sezione 2 — Misure di sicurezza tecniche (art. 24, comma 2)',
      '  - Cifratura at-rest (AES-256) e in-transit (TLS 1.3).',
      '  - Autenticazione con MFA per ruoli admin (target enabled).',
      '  - Controllo accessi RBAC per modulo (vedi RolesGuard).',
      '  - Backup giornalieri off-site con test di ripristino trimestrale.',
      '  - Log immutabili per 10 anni (DPCM 3/12/2013).',
      '',
      'Sezione 3 — Notifica incidenti (art. 25)',
      '  Allerta precoce all\'ACN entro 24 ore dalla rilevazione di un',
      '  incidente significativo. Notifica completa entro 72 ore.',
      '  Relazione finale entro 30 giorni.',
      '',
      'Sezione 4 — Catena di approvvigionamento (art. 25)',
      '  Vendor-DD documentata per i fornitori critici (ADR-016, ADR-019,',
      '  ADR-025, ADR-037). Conservazione a Norma con primary +',
      '  secondary per il tier Professionale+ (ADR-025).',
      '',
      'Sezione 5 — Audit + tracciabilita (ultimi 30 giorni)',
      `  Eventi audit totali: ${auditCounts.total}`,
      `  - successi: ${auditCounts.success}`,
      `  - failure: ${auditCounts.failure}`,
      `  - denied:  ${auditCounts.denied}`,
      '',
      'Sezione 6 — Documenti collegati',
      '  - docs/SECURITY.md',
      '  - docs/SECURITY-SELF-ASSESSMENT.md',
      '  - docs/RISK-ACCEPTANCES.md',
      '  - docs/DATA_GOVERNANCE.md',
      '  - docs/RUNBOOK.md',
      '',
      'Firmato: SmartERP Compliance — generato dal sistema.',
    ];

    return {
      filename: `nis2-compliance-pack-${tenant.id}-${new Date().toISOString().slice(0, 10)}.pdf`,
      contentType: 'application/pdf',
      body: renderMinimalPdf(lines),
    };
  }

  async generateSecurityPack(
    tenantId: string,
  ): Promise<{ filename: string; body: Buffer; contentType: string }> {
    const nis2 = await this.generateNis2Pack(tenantId);
    // For v1 the security pack reuses the NIS2 PDF; future revisions
    // (§9.16) bundle the GDPR DPIA, the SOC 2 controls trace, and
    // the per-tenant risk register into a multi-section archive.
    return {
      ...nis2,
      filename: nis2.filename.replace('nis2-compliance-pack', 'security-pack'),
    };
  }

  async listAuditTrail(
    tenantId: string,
    filters: {
      action?: string;
      from?: Date;
      to?: Date;
      outcome?: 'success' | 'failure' | 'denied';
      limit?: number;
    } = {},
  ): Promise<AuditLog[]> {
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId });
    if (filters.action) qb.andWhere('a.action = :action', { action: filters.action });
    if (filters.outcome)
      qb.andWhere('a.outcome = :outcome', { outcome: filters.outcome });
    if (filters.from) qb.andWhere('a.createdAt >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('a.createdAt < :to', { to: filters.to });
    return qb
      .orderBy('a.createdAt', 'DESC')
      .limit(filters.limit ?? 200)
      .getMany();
  }

  // ─── Private ────────────────────────────────────────────

  private async auditCountsLast30Days(
    tenantId: string,
  ): Promise<{
    total: number;
    success: number;
    failure: number;
    denied: number;
  }> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await this.auditRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.createdAt >= :since', { since })
      .getMany();
    const out = { total: rows.length, success: 0, failure: 0, denied: 0 };
    for (const r of rows) {
      if (r.outcome === 'success') out.success += 1;
      else if (r.outcome === 'failure') out.failure += 1;
      else if (r.outcome === 'denied') out.denied += 1;
    }
    return out;
  }
}
