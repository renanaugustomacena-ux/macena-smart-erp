import { DataSource } from 'typeorm';
import { MarketplacePackage } from '../marketplace/entities/marketplace-package.entity';

/**
 * First marketplace partners (plan §31.3 Sprint 38).
 *
 * v1 ships seven launch partners covering the most-requested
 * adjacencies for Verona/Veneto manifatturiere SMEs.
 */
const LAUNCH_PARTNERS = [
  {
    vendor: 'iso9001-ready',
    slug: 'iso-9001-quality',
    displayName: 'ISO 9001 Quality Management',
    descriptionMd:
      '# ISO 9001 quality\n\nNon-conformance + CAPA + audit trail extension. Verona-based partner; covers ISO 9001:2015 + IATF 16949 add-on.',
    version: '1.0.0',
    scopes: ['quality.read', 'quality.write'],
    monthlyPriceCents: 4_900,
    contactEmail: 'sales@iso9001-ready.example',
  },
  {
    vendor: 'fp-scheduling',
    slug: 'finite-capacity-scheduling',
    displayName: 'Finite-Capacity Production Scheduling',
    descriptionMd:
      'Advanced scheduler with finite-capacity constraints + setup-time matrices. Built on top of the Sprint 29 SchedulingService port.',
    version: '0.9.0',
    scopes: ['scheduling.read', 'scheduling.write'],
    monthlyPriceCents: 12_900,
    contactEmail: 'partners@fp-scheduling.example',
  },
  {
    vendor: 'edi-odette',
    slug: 'odette-galia-edi',
    displayName: 'Odette + GALIA EDI',
    descriptionMd:
      'EDI bridge for Odette + GALIA messages (DELINS, ORDERS, INVOIC) used by Italian automotive tier-2 / tier-3 suppliers.',
    version: '1.0.0',
    scopes: ['edi.in', 'edi.out'],
    monthlyPriceCents: 9_900,
    contactEmail: 'edi@partners.example',
  },
  {
    vendor: 'opc-ua',
    slug: 'opc-ua-cnc',
    displayName: 'CNC / OPC-UA Connectivity',
    descriptionMd:
      'OPC-UA bridge to CNC machines on the shop floor. Pulls cycle counters + alarms into the production module.',
    version: '0.8.0',
    scopes: ['production.read'],
    monthlyPriceCents: 7_900,
    contactEmail: 'industry40@partners.example',
  },
  {
    vendor: 'shopify-bridge',
    slug: 'shopify-orders-sync',
    displayName: 'Shopify Orders Sync',
    descriptionMd:
      'Bidirectional Shopify orders + inventory sync. Built on the Sprint 21 ShopifyConnector.',
    version: '1.0.0',
    scopes: ['sales.read', 'sales.write', 'inventory.write'],
    monthlyPriceCents: 4_900,
    contactEmail: 'partners@shopify-bridge.example',
  },
  {
    vendor: 'wc-bridge',
    slug: 'woocommerce-sync',
    displayName: 'WooCommerce Sync',
    descriptionMd: 'WooCommerce → SmartERP orders + inventory sync.',
    version: '0.9.0',
    scopes: ['sales.read', 'sales.write'],
    monthlyPriceCents: 3_900,
    contactEmail: 'partners@wc-bridge.example',
  },
  {
    vendor: 'amazon-vendor',
    slug: 'amazon-vendor-central',
    displayName: 'Amazon Vendor Central',
    descriptionMd:
      'EDI 850/855/856/810 bridge to Amazon Vendor Central. Tier-2 / tier-3 suppliers shipping to Amazon EU.',
    version: '0.7.0',
    scopes: ['sales.write', 'inventory.read'],
    monthlyPriceCents: 9_900,
    contactEmail: 'amazon-vc@partners.example',
  },
];

export async function seedMarketplacePartners(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(MarketplacePackage);
  for (const p of LAUNCH_PARTNERS) {
    const existing = await repo.findOne({
      where: { vendor: p.vendor, slug: p.slug },
    });
    if (existing) {
      Object.assign(existing, p);
      await repo.save(existing);
    } else {
      await repo.save(repo.create({ ...p, status: 'active' }));
    }
  }
}
