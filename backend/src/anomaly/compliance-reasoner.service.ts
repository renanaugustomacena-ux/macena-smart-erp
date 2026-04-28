import { Injectable } from '@nestjs/common';

/**
 * Compliance reasoner (plan §31.2 Sprint 30).
 *
 * Static-rule reasoner over the tenant's compliance state. v1
 * encodes a fixed rulebook for IVA periodicity, NIS2 incident-response
 * cadence, and Conservazione retention. Future revisions expose a
 * declarative rules editor (Sprint 35 alongside the SOC 2 audit prep).
 */
export interface ComplianceFinding {
  ruleId: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  reference: string;
}

interface ReasonerInput {
  invoicesLast30Days: number;
  supplierInvoicesLast30Days: number;
  intrastatDeclarationsLast90Days: number;
  conservazioneVersamentiLast30Days: number;
  ssoConfigured: boolean;
  breakGlassEmailRotatedDaysAgo: number | null;
}

@Injectable()
export class ComplianceReasonerService {
  reason(input: ReasonerInput): ComplianceFinding[] {
    const out: ComplianceFinding[] = [];

    if (
      input.invoicesLast30Days > 0 &&
      input.conservazioneVersamentiLast30Days < input.invoicesLast30Days
    ) {
      out.push({
        ruleId: 'conservazione.coverage_below_invoices',
        severity: 'critical',
        message:
          'Conservazione versamenti < numero fatture nello stesso periodo. Tutte le fatture ' +
          'attive devono essere conservate (DPCM 3/12/2013 + D.Lgs. 127/2015).',
        reference: 'docs/ITALIAN-COMPLIANCE.md §3.3 + ADR-016',
      });
    }

    if (input.supplierInvoicesLast30Days > 30 && !input.ssoConfigured) {
      out.push({
        ruleId: 'sso.recommended_for_active_tenants',
        severity: 'warning',
        message:
          'Tenant con > 30 fatture passive/mese: si raccomanda l\'attivazione SSO + MFA per soddisfare NIS2 art. 24.',
        reference: 'ADR-017 + D.Lgs. 138/2024 art. 24',
      });
    }

    if (
      input.breakGlassEmailRotatedDaysAgo !== null &&
      input.breakGlassEmailRotatedDaysAgo > 30
    ) {
      out.push({
        ruleId: 'breakglass.rotation_overdue',
        severity: 'warning',
        message: `Break-glass admin non ruotata da ${input.breakGlassEmailRotatedDaysAgo} giorni — la policy richiede rotazione mensile.`,
        reference: 'docs/RUNBOOK.md §20.4',
      });
    }

    if (input.intrastatDeclarationsLast90Days === 0 && input.invoicesLast30Days > 0) {
      out.push({
        ruleId: 'intrastat.no_declarations_filed',
        severity: 'info',
        message:
          'Nessuna dichiarazione INTRA-1bis/2bis negli ultimi 90 giorni; verificare se il tenant ha controparti intra-UE.',
        reference: 'AE 88406/2017 + ADM 13799/RU/2018',
      });
    }

    return out;
  }
}
