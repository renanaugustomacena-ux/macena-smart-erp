import { buildPain001 } from './sepa-pain001';

describe('SEPA pain.001.001.09 builder (S31)', () => {
  it('emits a valid-shape XML envelope with control sums', () => {
    const xml = buildPain001({
      msgId: 'BATCH-2026-04-29-001',
      initiatorName: 'Acme Spa',
      initiatorIban: 'IT60X0542811101000000123456',
      initiatorBic: 'BPMOIT22XXX',
      payments: [
        {
          endToEndId: 'E2E-1',
          amountCents: 12_345,
          currency: 'EUR',
          beneficiaryName: 'Beta Srl',
          beneficiaryIban: 'IT89A0306909606100000123456',
          remittanceInfo: 'FATTURA 2026/0001',
          requestedExecutionDate: '2026-05-15',
        },
        {
          endToEndId: 'E2E-2',
          amountCents: 67_890,
          currency: 'EUR',
          beneficiaryName: 'Gamma Srl',
          beneficiaryIban: 'IT12A0301503200000000654321',
          requestedExecutionDate: '2026-05-15',
        },
      ],
    });
    expect(xml).toContain('<NbOfTxs>2</NbOfTxs>');
    expect(xml).toContain('<CtrlSum>802.35</CtrlSum>');
    expect(xml).toContain('<EndToEndId>E2E-1</EndToEndId>');
    expect(xml).toContain('<IBAN>IT89A0306909606100000123456</IBAN>');
    expect(xml).toContain('pain.001.001.09');
  });
});
