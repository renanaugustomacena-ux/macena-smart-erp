import { FatturaPaAdapter, FatturaPaBuildInput } from './fatturapa-adapter';
import { InvoiceDocumentType } from '../accounting.entity';
import { CustomerType } from '../../sales/sales.entity';

describe('FatturaPaAdapter', () => {
  const adapter = new FatturaPaAdapter();

  function buildInput(overrides: Partial<FatturaPaBuildInput> = {}): FatturaPaBuildInput {
    return {
      tenant: {
        vatNumber: '02345678901',
        fiscalCode: '02345678901',
        name: 'Fonderia Mozzecane SRL',
        billingAddress: 'Via Industriale 42',
        billingCity: 'Mozzecane',
        billingPostalCode: '37060',
        billingProvince: 'VR',
        billingCountry: 'IT',
      },
      customer: {
        vatNumber: '01234567890',
        fiscalCode: null as unknown as string,
        name: 'Meccanica Scaligera SRL',
        sdiDestinationCode: 'USAL8PV',
        pecEmail: null as unknown as string,
        address: 'Via delle Industrie 23',
        postalCode: '37138',
        city: 'Verona',
        province: 'VR',
        country: 'IT',
        customerType: CustomerType.BUSINESS,
        splitPayment: false,
      },
      invoice: {
        number: '000001',
        fiscalYear: 2026,
        invoiceDate: new Date('2026-04-15T00:00:00Z'),
        documentType: InvoiceDocumentType.TD01,
        subtotalAmount: 890,
        taxAmount: 195.8,
        totalAmount: 1085.8,
        notes: undefined as unknown as string,
        lines: [
          {
            description: 'Valvola A100 x 10',
            quantity: 10,
            unitPrice: 89,
            ivaRate: 22,
            lineTotal: 890,
          },
        ],
      },
      ...overrides,
    };
  }

  it('produces a valid B2B FatturaPA with EsigibilitaIVA=I', () => {
    const { xml, fileName, progressive } = adapter.build(buildInput());
    expect(fileName).toBe(`IT02345678901_${progressive}.xml`);
    expect(xml).toContain('<FormatoTrasmissione>FPR12</FormatoTrasmissione>');
    expect(xml).toContain('<TipoDocumento>TD01</TipoDocumento>');
    expect(xml).toContain('<ImportoTotaleDocumento>1085.80</ImportoTotaleDocumento>');
    expect(xml).toContain('<EsigibilitaIVA>I</EsigibilitaIVA>');
    expect(xml).toContain('<AliquotaIVA>22.00</AliquotaIVA>');
    expect(xml).toContain('<CodiceDestinatario>USAL8PV</CodiceDestinatario>');
  });

  it('produces FPA12 format for public-administration with split payment', () => {
    const input = buildInput({
      customer: {
        ...buildInput().customer,
        customerType: CustomerType.PUBLIC_ADMINISTRATION,
        splitPayment: true,
        vatNumber: null as unknown as string,
        fiscalCode: '80022190233',
        sdiDestinationCode: 'UFXE7W',
      },
    });
    const { xml } = adapter.build(input);
    expect(xml).toContain('<FormatoTrasmissione>FPA12</FormatoTrasmissione>');
    expect(xml).toContain('<EsigibilitaIVA>S</EsigibilitaIVA>');
    expect(xml).toContain('<CodiceFiscale>80022190233</CodiceFiscale>');
    expect(xml).toContain('<CodiceDestinatario>UFXE7W</CodiceDestinatario>');
  });

  it('emits Natura element on reverse-charge lines', () => {
    const input = buildInput({
      invoice: {
        ...buildInput().invoice,
        lines: [
          {
            description: 'Cessione intra-UE',
            quantity: 3,
            unitPrice: 549,
            ivaRate: 0,
            ivaNature: 'N6.1',
            lineTotal: 1647,
          },
        ],
      },
    });
    const { xml } = adapter.build(input);
    expect(xml).toContain('<Natura>N6.1</Natura>');
  });

  it('XML-escapes customer name and description', () => {
    const input = buildInput({
      customer: {
        ...buildInput().customer,
        name: 'Smith & Sons <Ltd>',
      },
      invoice: {
        ...buildInput().invoice,
        lines: [
          {
            description: 'Item A & B "premium"',
            quantity: 1,
            unitPrice: 100,
            ivaRate: 22,
            lineTotal: 100,
          },
        ],
        subtotalAmount: 100,
        taxAmount: 22,
        totalAmount: 122,
      },
    });
    const { xml } = adapter.build(input);
    expect(xml).toContain('Smith &amp; Sons &lt;Ltd&gt;');
    expect(xml).toContain('Item A &amp; B &quot;premium&quot;');
    expect(xml).not.toMatch(/Smith & Sons <Ltd>/);
  });

  it('throws when tenant has no Partita IVA', () => {
    const input = buildInput();
    input.tenant = { ...input.tenant, vatNumber: null as unknown as string };
    expect(() => adapter.build(input)).toThrow(/Partita IVA/);
  });

  it('throws when customer has neither VAT nor fiscalCode', () => {
    const input = buildInput();
    input.customer = {
      ...input.customer,
      vatNumber: null as unknown as string,
      fiscalCode: null as unknown as string,
    };
    expect(() => adapter.build(input)).toThrow(/Partita IVA.*Codice Fiscale/);
  });

  it('defaults CodiceDestinatario to 0000000 when not in valid 7-char pattern', () => {
    const input = buildInput();
    input.customer = { ...input.customer, sdiDestinationCode: 'XX' };
    const { xml } = adapter.build(input);
    expect(xml).toContain('<CodiceDestinatario>0000000</CodiceDestinatario>');
  });
});
