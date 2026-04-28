import { ComplianceReasonerService } from './compliance-reasoner.service';

describe('ComplianceReasonerService (S30)', () => {
  const svc = new ComplianceReasonerService();

  it('flags conservazione coverage below invoice count', () => {
    const r = svc.reason({
      invoicesLast30Days: 100,
      supplierInvoicesLast30Days: 0,
      intrastatDeclarationsLast90Days: 1,
      conservazioneVersamentiLast30Days: 50,
      ssoConfigured: true,
      breakGlassEmailRotatedDaysAgo: 5,
    });
    const ids = r.map((f) => f.ruleId);
    expect(ids).toContain('conservazione.coverage_below_invoices');
    expect(r.find((f) => f.ruleId === 'conservazione.coverage_below_invoices')?.severity).toBe('critical');
  });

  it('warns on overdue break-glass rotation', () => {
    const r = svc.reason({
      invoicesLast30Days: 1,
      supplierInvoicesLast30Days: 1,
      intrastatDeclarationsLast90Days: 1,
      conservazioneVersamentiLast30Days: 1,
      ssoConfigured: true,
      breakGlassEmailRotatedDaysAgo: 60,
    });
    expect(r.map((f) => f.ruleId)).toContain('breakglass.rotation_overdue');
  });
});
