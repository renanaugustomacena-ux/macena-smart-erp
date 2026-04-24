/**
 * Seed script populating a demo tenant "Fonderia Mozzecane SRL" per plan
 * moonlit-humming-reef §5.1 SmartERP:
 *   - 10 products
 *   - 2 warehouses
 *   - 5 customers
 *   - 5 suppliers (modelled as customers of CustomerType=BUSINESS in the
 *     sales catalog AND as product.supplier strings on the 10 products)
 *   - 20 inventory movements
 *   - 3 production orders
 *   - 5 sales orders
 *   - 3 invoices (one submitted for SDI)
 *   - 50 journal entries
 *
 * Idempotent: safe to run repeatedly. Re-running after the first execution
 * is a no-op if the demo tenant already exists and has the expected fixture
 * counts.
 *
 * Usage:
 *   npm run seed              — seed the default demo tenant
 *   npm run seed -- --reset   — delete the existing demo tenant, then seed
 */

/* eslint-disable no-console */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';

import { Tenant, SubscriptionPlan, TenantStatus } from '../tenants/tenant.entity';
import { User, UserRole } from '../auth/auth.service';
import {
  Product,
  ProductCategory,
  StockLevel,
  StockMovement,
  StockMovementType,
  UnitOfMeasure,
  Warehouse,
} from '../inventory/inventory.entity';
import {
  ProductionOrder,
  ProductionOrderStatus,
  Priority,
} from '../production/production.service';
import { Customer, CustomerType, SalesOrder, SalesOrderStatus } from '../sales/sales.entity';
import {
  ChartOfAccount,
  Invoice,
  InvoiceDocumentType,
  InvoiceStatus,
  JournalEntry,
} from '../accounting/accounting.entity';
import { AccountingService } from '../accounting/accounting.service';
import { hashPassword } from '../common/password.util';

const DEMO_TENANT_NAME = 'Fonderia Mozzecane SRL';
const DEMO_TENANT_VAT = '02345678901';
const DEMO_ADMIN_EMAIL = 'admin@fonderia-mozzecane.test';
const DEMO_ADMIN_PASSWORD = 'FonderiaMozzecane2026!';

async function run(): Promise<void> {
  const reset = process.argv.includes('--reset');
  const logger = new Logger('Seed');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const dataSource = app.get<DataSource>(getDataSourceToken());
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const tenantRepo: Repository<Tenant> = app.get(getRepositoryToken(Tenant));
  const userRepo: Repository<User> = app.get(getRepositoryToken(User));
  const productRepo: Repository<Product> = app.get(getRepositoryToken(Product));
  const warehouseRepo: Repository<Warehouse> = app.get(getRepositoryToken(Warehouse));
  const stockLevelRepo: Repository<StockLevel> = app.get(getRepositoryToken(StockLevel));
  const movementRepo: Repository<StockMovement> = app.get(getRepositoryToken(StockMovement));
  const productionRepo: Repository<ProductionOrder> = app.get(getRepositoryToken(ProductionOrder));
  const customerRepo: Repository<Customer> = app.get(getRepositoryToken(Customer));
  const salesOrderRepo: Repository<SalesOrder> = app.get(getRepositoryToken(SalesOrder));
  const accountRepo: Repository<ChartOfAccount> = app.get(getRepositoryToken(ChartOfAccount));
  const invoiceRepo: Repository<Invoice> = app.get(getRepositoryToken(Invoice));
  const journalRepo: Repository<JournalEntry> = app.get(getRepositoryToken(JournalEntry));
  const accountingService = app.get(AccountingService);

  let tenant = await tenantRepo.findOne({ where: { vatNumber: DEMO_TENANT_VAT } });

  if (tenant && reset) {
    logger.warn(`Resetting tenant ${tenant.id} — all linked data removed`);
    await deleteTenantData(dataSource, tenant.id);
    tenant = null;
  }

  if (!tenant) {
    tenant = tenantRepo.create({
      name: DEMO_TENANT_NAME,
      vatNumber: DEMO_TENANT_VAT,
      fiscalCode: DEMO_TENANT_VAT,
      sdiDestinationCode: '0000000',
      pecEmail: 'fatture@pec.fonderia-mozzecane.test',
      billingAddress: 'Via Industriale 42',
      billingCity: 'Mozzecane',
      billingPostalCode: '37060',
      billingProvince: 'VR',
      billingCountry: 'IT',
      plan: SubscriptionPlan.PROFESSIONALE,
      status: TenantStatus.ACTIVE,
      seatLimit: 15,
      settings: {
        locale: 'it',
        timezone: 'Europe/Rome',
        currency: 'EUR',
        iva_default: 22,
        accounting_template: 'pc_iv_direttiva_cee',
      },
    });
    tenant = await tenantRepo.save(tenant);
    logger.log(`Tenant created: ${tenant.id} (${tenant.name})`);
  } else {
    logger.log(`Tenant exists: ${tenant.id} — will upsert fixtures`);
  }

  // Admin user
  const existingAdmin = await userRepo.findOne({ where: { email: DEMO_ADMIN_EMAIL } });
  if (!existingAdmin) {
    const passwordHash = await hashPassword(DEMO_ADMIN_PASSWORD);
    await userRepo.save(
      userRepo.create({
        firstName: 'Giovanni',
        lastName: 'Mozzecane',
        email: DEMO_ADMIN_EMAIL,
        passwordHash,
        companyName: DEMO_TENANT_NAME,
        phone: '+39 045 123 4567',
        partitaIva: DEMO_TENANT_VAT,
        role: UserRole.ADMIN,
        tenantId: tenant.id,
        isActive: true,
        tokenVersion: 0,
      }),
    );
    logger.log(`Admin user created: ${DEMO_ADMIN_EMAIL}`);
  }

  // ─── Chart of Accounts ────────────────────────────────────────
  await accountingService.seedChartOfAccounts(tenant.id);

  // ─── Warehouses ──────────────────────────────────────────────
  const warehouses = await upsertWarehouses(warehouseRepo, tenant.id);
  logger.log(`Warehouses ready: ${warehouses.length}`);

  // ─── Products ────────────────────────────────────────────────
  const products = await upsertProducts(productRepo, tenant.id);
  logger.log(`Products ready: ${products.length}`);

  // ─── Stock levels + 20 inventory movements ───────────────────
  const movementsSeeded = await upsertMovements(
    movementRepo,
    stockLevelRepo,
    tenant.id,
    products,
    warehouses,
  );
  logger.log(`Inventory movements seeded: ${movementsSeeded}`);

  // ─── Customers (5) ───────────────────────────────────────────
  const customers = await upsertCustomers(customerRepo, tenant.id);
  logger.log(`Customers ready: ${customers.length}`);

  // ─── Production orders (3) ───────────────────────────────────
  const prodSeeded = await upsertProductionOrders(
    productionRepo,
    tenant.id,
    products,
  );
  logger.log(`Production orders seeded: ${prodSeeded}`);

  // ─── Sales orders (5) ────────────────────────────────────────
  const soSeeded = await upsertSalesOrders(
    salesOrderRepo,
    tenant.id,
    customers,
    products,
    warehouses,
  );
  logger.log(`Sales orders seeded: ${soSeeded}`);

  // ─── Invoices (3) ────────────────────────────────────────────
  const invSeeded = await upsertInvoices(invoiceRepo, tenant.id, customers);
  logger.log(`Invoices seeded: ${invSeeded}`);

  // ─── Journal entries (50) ────────────────────────────────────
  const jeSeeded = await upsertJournalEntries(
    journalRepo,
    accountRepo,
    tenant.id,
  );
  logger.log(`Journal entries seeded: ${jeSeeded}`);

  await app.close();
  logger.log('Seed completed.');
  logger.log(`Demo tenant id    : ${tenant.id}`);
  logger.log(`Demo admin email  : ${DEMO_ADMIN_EMAIL}`);
  logger.log(`Demo admin password: ${DEMO_ADMIN_PASSWORD} (rotate in production!)`);
}

async function deleteTenantData(ds: DataSource, tenantId: string): Promise<void> {
  const tables = [
    'stock_movements',
    'stock_levels',
    'warehouses',
    'production_orders',
    'work_orders',
    'invoices',
    'journal_entries',
    'chart_of_accounts',
    'sales_orders',
    'customers',
    'products',
    'users',
    'tenants',
  ];
  for (const t of tables) {
    try {
      await ds.query(
        `DELETE FROM "${t}" WHERE ` +
          (t === 'tenants' ? `"id" = $1` : `"tenantId" = $1`),
        [tenantId],
      );
    } catch {
      /* table may not exist in fresh DB */
    }
  }
}

async function upsertWarehouses(
  repo: Repository<Warehouse>,
  tenantId: string,
): Promise<Warehouse[]> {
  const specs: Partial<Warehouse>[] = [
    {
      code: 'MAG-01',
      name: 'Magazzino Principale Mozzecane',
      address: 'Via Industriale 42',
      city: 'Mozzecane',
      postalCode: '37060',
      province: 'VR',
      contactPerson: 'Luigi Bianchi',
      capacitySquareMeters: 2500,
      isActive: true,
    },
    {
      code: 'MAG-02',
      name: 'Magazzino Satellite Verona',
      address: 'Via del Lavoro 15',
      city: 'Verona',
      postalCode: '37138',
      province: 'VR',
      contactPerson: 'Anna Rossi',
      capacitySquareMeters: 1200,
      isActive: true,
    },
  ];
  const out: Warehouse[] = [];
  for (const s of specs) {
    let w = await repo.findOne({ where: { tenantId, code: s.code! } });
    if (!w) {
      w = await repo.save(repo.create({ ...s, tenantId }));
    }
    out.push(w);
  }
  return out;
}

async function upsertProducts(
  repo: Repository<Product>,
  tenantId: string,
): Promise<Product[]> {
  const specs: Partial<Product>[] = [
    {
      sku: 'MAT-AX304',
      name: 'Acciaio Inox AISI 304 (lamiera 2mm)',
      category: ProductCategory.RAW_MATERIAL,
      unitOfMeasure: UnitOfMeasure.KILOGRAM,
      unitCost: 3.5,
      sellingPrice: 5.0,
      minimumStock: 200,
      reorderPoint: 400,
      reorderQuantity: 1000,
      supplier: 'Acciai Lombardi SpA',
    },
    {
      sku: 'MAT-ALU6061',
      name: 'Alluminio 6061 tondo 40mm',
      category: ProductCategory.RAW_MATERIAL,
      unitOfMeasure: UnitOfMeasure.KILOGRAM,
      unitCost: 4.2,
      sellingPrice: 6.0,
      minimumStock: 150,
      reorderPoint: 300,
      reorderQuantity: 800,
      supplier: 'Metalli del Veneto SRL',
    },
    {
      sku: 'MAT-OTT58',
      name: 'Ottone CuZn39Pb3 tondo 20mm',
      category: ProductCategory.RAW_MATERIAL,
      unitOfMeasure: UnitOfMeasure.KILOGRAM,
      unitCost: 8.1,
      sellingPrice: 11.0,
      minimumStock: 80,
      reorderPoint: 160,
      reorderQuantity: 400,
      supplier: 'Ottoni Bresciani SRL',
    },
    {
      sku: 'SEMI-FLAN-120',
      name: 'Semilavorato flangia DN120 grezza',
      category: ProductCategory.SEMI_FINISHED,
      unitOfMeasure: UnitOfMeasure.PIECE,
      unitCost: 14.5,
      sellingPrice: 22.0,
      minimumStock: 50,
      reorderPoint: 100,
      reorderQuantity: 250,
      supplier: 'Fonderia Mozzecane SRL',
    },
    {
      sku: 'PROD-VALVE-A100',
      name: 'Valvola di sezionamento A100 finita',
      category: ProductCategory.FINISHED_PRODUCT,
      unitOfMeasure: UnitOfMeasure.PIECE,
      unitCost: 35.0,
      sellingPrice: 89.0,
      minimumStock: 30,
      reorderPoint: 60,
      reorderQuantity: 120,
      supplier: 'Fonderia Mozzecane SRL',
    },
    {
      sku: 'PROD-PUMP-P50',
      name: 'Pompa centrifuga P50 assemblata',
      category: ProductCategory.FINISHED_PRODUCT,
      unitOfMeasure: UnitOfMeasure.PIECE,
      unitCost: 210.0,
      sellingPrice: 549.0,
      minimumStock: 10,
      reorderPoint: 20,
      reorderQuantity: 40,
      supplier: 'Fonderia Mozzecane SRL',
    },
    {
      sku: 'CONS-OIL-GP',
      name: 'Olio lubrificante per macchina utensile 20L',
      category: ProductCategory.CONSUMABLE,
      unitOfMeasure: UnitOfMeasure.LITER,
      unitCost: 4.5,
      sellingPrice: 0,
      minimumStock: 40,
      reorderPoint: 60,
      reorderQuantity: 200,
      supplier: 'Lubrificanti Industriali SpA',
    },
    {
      sku: 'PACK-PAL-EU',
      name: 'Pallet EPAL 800x1200 certificato',
      category: ProductCategory.PACKAGING,
      unitOfMeasure: UnitOfMeasure.PALLET,
      unitCost: 12.0,
      sellingPrice: 0,
      minimumStock: 50,
      reorderPoint: 100,
      reorderQuantity: 200,
      supplier: 'Imballaggi Scaligeri SRL',
    },
    {
      sku: 'SPARE-BRG-6205',
      name: 'Cuscinetto 6205-2RS',
      category: ProductCategory.SPARE_PART,
      unitOfMeasure: UnitOfMeasure.PIECE,
      unitCost: 3.2,
      sellingPrice: 8.5,
      minimumStock: 200,
      reorderPoint: 400,
      reorderQuantity: 1000,
      supplier: 'Metalli del Veneto SRL',
    },
    {
      sku: 'PROD-CONN-K8',
      name: 'Connettore meccanico K8 finito',
      category: ProductCategory.FINISHED_PRODUCT,
      unitOfMeasure: UnitOfMeasure.PIECE,
      unitCost: 2.9,
      sellingPrice: 7.5,
      minimumStock: 500,
      reorderPoint: 1000,
      reorderQuantity: 3000,
      supplier: 'Fonderia Mozzecane SRL',
    },
  ];
  const out: Product[] = [];
  for (const s of specs) {
    let p = await repo.findOne({ where: { tenantId, sku: s.sku! } });
    if (!p) {
      p = await repo.save(repo.create({ ...s, tenantId, isActive: true }));
    }
    out.push(p);
  }
  return out;
}

async function upsertMovements(
  mvRepo: Repository<StockMovement>,
  slRepo: Repository<StockLevel>,
  tenantId: string,
  products: Product[],
  warehouses: Warehouse[],
): Promise<number> {
  const existing = await mvRepo.count({ where: { tenantId } });
  const need = Math.max(0, 20 - existing);
  if (need === 0) return existing;

  const now = new Date();
  let seeded = 0;
  for (let i = 0; i < need; i++) {
    const product = products[i % products.length];
    const wh = warehouses[i % warehouses.length];
    const type =
      i % 4 === 0
        ? StockMovementType.INBOUND
        : i % 4 === 1
          ? StockMovementType.OUTBOUND
          : i % 4 === 2
            ? StockMovementType.TRANSFER
            : StockMovementType.ADJUSTMENT;
    const quantity = 25 + (i * 7) % 175;
    const sourceWarehouseId =
      type === StockMovementType.OUTBOUND || type === StockMovementType.TRANSFER
        ? wh.id
        : undefined;
    const destinationWarehouseId =
      type === StockMovementType.INBOUND ||
      type === StockMovementType.ADJUSTMENT ||
      type === StockMovementType.TRANSFER
        ? warehouses[(i + 1) % warehouses.length].id
        : undefined;
    const mv = mvRepo.create({
      tenantId,
      productId: product.id,
      movementType: type,
      quantity,
      sourceWarehouseId,
      destinationWarehouseId,
      referenceNumber: `SEED-${String(i + 1).padStart(5, '0')}`,
      notes: 'Seed movement',
      performedBy: 'seed-script',
      unitCostAtTime: Number(product.unitCost ?? 0),
    });
    await mvRepo.save(mv);
    // Adjust stock levels
    if (destinationWarehouseId && type !== StockMovementType.OUTBOUND) {
      await bumpStock(slRepo, tenantId, product.id, destinationWarehouseId, quantity);
    }
    if (sourceWarehouseId) {
      await bumpStock(slRepo, tenantId, product.id, sourceWarehouseId, -quantity);
    }
    seeded++;
  }
  return existing + seeded;
}

async function bumpStock(
  slRepo: Repository<StockLevel>,
  tenantId: string,
  productId: string,
  warehouseId: string,
  delta: number,
): Promise<void> {
  let sl = await slRepo.findOne({
    where: { tenantId, productId, warehouseId },
  });
  if (!sl) {
    sl = slRepo.create({
      tenantId,
      productId,
      warehouseId,
      quantityOnHand: 0,
      quantityReserved: 0,
      quantityOnOrder: 0,
    });
  }
  const next = Number(sl.quantityOnHand) + delta;
  sl.quantityOnHand = Math.max(0, next);
  await slRepo.save(sl);
}

async function upsertCustomers(
  repo: Repository<Customer>,
  tenantId: string,
): Promise<Customer[]> {
  const specs: Partial<Customer>[] = [
    {
      code: 'CUST-001',
      name: 'Meccanica Scaligera SRL',
      customerType: CustomerType.BUSINESS,
      vatNumber: '01234567890',
      sdiDestinationCode: 'USAL8PV',
      pecEmail: 'fatture@pec.meccanica-scaligera.test',
      email: 'ordini@meccanica-scaligera.test',
      phone: '+39 045 987 6543',
      address: 'Via delle Industrie 23',
      city: 'Verona',
      postalCode: '37138',
      province: 'VR',
      country: 'IT',
      defaultIvaRate: 22,
      paymentTermsDays: 60,
      splitPayment: false,
      isActive: true,
    },
    {
      code: 'CUST-002',
      name: 'Comune di Mozzecane',
      customerType: CustomerType.PUBLIC_ADMINISTRATION,
      fiscalCode: '80022190233',
      sdiDestinationCode: 'UFXE7W',
      pecEmail: 'protocollo@pec.comune.mozzecane.vr.it',
      email: 'uff.tecnico@comune.mozzecane.vr.it',
      address: 'Piazza Vittorio Emanuele 1',
      city: 'Mozzecane',
      postalCode: '37060',
      province: 'VR',
      country: 'IT',
      defaultIvaRate: 22,
      paymentTermsDays: 30,
      splitPayment: true,
      isActive: true,
    },
    {
      code: 'CUST-003',
      name: 'Idraulica Veneta SNC',
      customerType: CustomerType.BUSINESS,
      vatNumber: '02345678912',
      sdiDestinationCode: '0000000',
      pecEmail: 'amministrazione@pec.idraulica-veneta.test',
      email: 'info@idraulica-veneta.test',
      address: 'Via Roma 10',
      city: 'Vicenza',
      postalCode: '36100',
      province: 'VI',
      country: 'IT',
      defaultIvaRate: 22,
      paymentTermsDays: 90,
      splitPayment: false,
      isActive: true,
    },
    {
      code: 'CUST-004',
      name: 'Pompe Industriali SpA',
      customerType: CustomerType.BUSINESS,
      vatNumber: '03456789123',
      sdiDestinationCode: '0000000',
      pecEmail: 'contabilita@pec.pompe-industriali.test',
      email: 'acquisti@pompe-industriali.test',
      address: 'Viale del Commercio 5',
      city: 'Padova',
      postalCode: '35100',
      province: 'PD',
      country: 'IT',
      defaultIvaRate: 22,
      paymentTermsDays: 60,
      splitPayment: false,
      isActive: true,
    },
    {
      code: 'CUST-005',
      name: 'Technik Handel GmbH',
      customerType: CustomerType.FOREIGN,
      vatNumber: 'DE123456789',
      sdiDestinationCode: 'XXXXXXX',
      email: 'einkauf@technik-handel.test',
      address: 'Industriestraße 42',
      city: 'München',
      postalCode: '80339',
      province: 'BY',
      country: 'DE',
      defaultIvaRate: 0, // Cross-border intra-EU B2B — reverse charge art. 17 DPR 633/1972
      paymentTermsDays: 30,
      splitPayment: false,
      isActive: true,
    },
  ];
  const out: Customer[] = [];
  for (const s of specs) {
    let c = await repo.findOne({ where: { tenantId, code: s.code! } });
    if (!c) {
      c = await repo.save(repo.create({ ...s, tenantId }));
    }
    out.push(c);
  }
  return out;
}

async function upsertProductionOrders(
  repo: Repository<ProductionOrder>,
  tenantId: string,
  products: Product[],
): Promise<number> {
  const existing = await repo.count({ where: { tenantId } });
  if (existing >= 3) return existing;
  const year = new Date().getFullYear();
  const specs = [
    {
      orderNumber: `PO-${year}-00001`,
      productName: 'Valvola A100 — Lotto Maggio',
      productId: products.find((p) => p.sku === 'PROD-VALVE-A100')?.id,
      quantityPlanned: 500,
      status: ProductionOrderStatus.PLANNED,
      priority: Priority.HIGH,
      plannedStartDate: new Date(year, 4, 1),
      plannedEndDate: new Date(year, 4, 15),
      notes: 'Lotto per commessa CUST-003',
      billOfMaterials: [
        {
          materialId: products.find((p) => p.sku === 'MAT-OTT58')!.id,
          materialName: 'Ottone CuZn39Pb3',
          quantityRequired: 0.25,
          unit: 'kg',
        },
        {
          materialId: products.find((p) => p.sku === 'MAT-AX304')!.id,
          materialName: 'Acciaio Inox 304',
          quantityRequired: 0.1,
          unit: 'kg',
        },
      ],
    },
    {
      orderNumber: `PO-${year}-00002`,
      productName: 'Pompa P50 — Serie Primavera',
      productId: products.find((p) => p.sku === 'PROD-PUMP-P50')?.id,
      quantityPlanned: 80,
      status: ProductionOrderStatus.CONFIRMED,
      priority: Priority.NORMAL,
      plannedStartDate: new Date(year, 4, 5),
      plannedEndDate: new Date(year, 4, 25),
      billOfMaterials: [
        {
          materialId: products.find((p) => p.sku === 'MAT-ALU6061')!.id,
          materialName: 'Alluminio 6061',
          quantityRequired: 3.5,
          unit: 'kg',
        },
        {
          materialId: products.find((p) => p.sku === 'SPARE-BRG-6205')!.id,
          materialName: 'Cuscinetti 6205-2RS',
          quantityRequired: 2,
          unit: 'pz',
        },
      ],
    },
    {
      orderNumber: `PO-${year}-00003`,
      productName: 'Connettore K8 — Serie Verona',
      productId: products.find((p) => p.sku === 'PROD-CONN-K8')?.id,
      quantityPlanned: 5000,
      status: ProductionOrderStatus.DRAFT,
      priority: Priority.LOW,
      plannedStartDate: new Date(year, 5, 1),
      plannedEndDate: new Date(year, 5, 10),
      billOfMaterials: [
        {
          materialId: products.find((p) => p.sku === 'MAT-AX304')!.id,
          materialName: 'Acciaio Inox 304',
          quantityRequired: 0.03,
          unit: 'kg',
        },
      ],
    },
  ];
  for (const s of specs.slice(existing)) {
    await repo.save(repo.create({ ...s, tenantId, quantityProduced: 0 }));
  }
  return specs.length;
}

async function upsertSalesOrders(
  repo: Repository<SalesOrder>,
  tenantId: string,
  customers: Customer[],
  products: Product[],
  warehouses: Warehouse[],
): Promise<number> {
  const existing = await repo.count({ where: { tenantId } });
  if (existing >= 5) return existing;
  const year = new Date().getFullYear();

  const orders: Partial<SalesOrder>[] = [];
  for (let i = 0; i < 5 - existing; i++) {
    const customer = customers[(existing + i) % customers.length];
    const productA = products[(existing + i) % products.length];
    const productB = products[(existing + i + 1) % products.length];
    const quantityA = 10 + i * 3;
    const quantityB = 5 + i * 2;
    const priceA = Number(productA.sellingPrice) || 10;
    const priceB = Number(productB.sellingPrice) || 5;
    const subtotal = quantityA * priceA + quantityB * priceB;
    const iva = customer.splitPayment ? 0 : subtotal * 0.22;
    const total = subtotal + iva;
    orders.push({
      orderNumber: `SO-${year}-${String(existing + i + 1).padStart(5, '0')}`,
      customerId: customer.id,
      status: i === 0 ? SalesOrderStatus.DRAFT : SalesOrderStatus.CONFIRMED,
      orderDate: new Date(),
      requestedDeliveryDate: new Date(Date.now() + 14 * 86400_000),
      customerPoReference: `PO-CLIENTE-${i + 1}`,
      notes: 'Ordine demo seed',
      subtotalAmount: Number(subtotal.toFixed(2)),
      taxAmount: Number(iva.toFixed(2)),
      totalAmount: Number(total.toFixed(2)),
      lines: [
        {
          productId: productA.id,
          sku: productA.sku,
          description: productA.name,
          quantity: quantityA,
          unitPrice: priceA,
          discountPct: 0,
          ivaRate: customer.splitPayment ? 22 : 22,
          lineTotal: Number((quantityA * priceA).toFixed(2)),
          warehouseId: warehouses[0].id,
        } as SalesOrder['lines'][number],
        {
          productId: productB.id,
          sku: productB.sku,
          description: productB.name,
          quantity: quantityB,
          unitPrice: priceB,
          discountPct: 0,
          ivaRate: customer.splitPayment ? 22 : 22,
          lineTotal: Number((quantityB * priceB).toFixed(2)),
          warehouseId: warehouses[0].id,
        } as SalesOrder['lines'][number],
      ],
    });
  }
  for (const o of orders) {
    await repo.save(repo.create({ ...o, tenantId }));
  }
  return (await repo.count({ where: { tenantId } }));
}

async function upsertInvoices(
  repo: Repository<Invoice>,
  tenantId: string,
  customers: Customer[],
): Promise<number> {
  const existing = await repo.count({ where: { tenantId } });
  if (existing >= 3) return existing;
  const year = new Date().getFullYear();

  const specs: Partial<Invoice>[] = [
    {
      documentType: InvoiceDocumentType.TD01,
      number: '000001',
      fiscalYear: year,
      invoiceDate: new Date(),
      customerId: customers[0].id,
      customerName: customers[0].name,
      customerVatNumber: customers[0].vatNumber,
      customerSdiCode: customers[0].sdiDestinationCode,
      customerPecEmail: customers[0].pecEmail,
      status: InvoiceStatus.ACCEPTED,
      subtotalAmount: 890,
      taxAmount: 195.8,
      totalAmount: 1085.8,
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
    {
      documentType: InvoiceDocumentType.TD01,
      number: '000002',
      fiscalYear: year,
      invoiceDate: new Date(),
      customerId: customers[1].id,
      customerName: customers[1].name,
      customerFiscalCode: customers[1].fiscalCode,
      customerSdiCode: customers[1].sdiDestinationCode,
      customerPecEmail: customers[1].pecEmail,
      status: InvoiceStatus.QUEUED, // submitted for SDI
      submittedAt: new Date(),
      subtotalAmount: 2250,
      taxAmount: 0, // split-payment PA (art. 17-ter DPR 633/1972)
      totalAmount: 2250,
      lines: [
        {
          description: 'Connettore K8 x 300 (split-payment)',
          quantity: 300,
          unitPrice: 7.5,
          ivaRate: 22,
          lineTotal: 2250,
        },
      ],
    },
    {
      documentType: InvoiceDocumentType.TD01,
      number: '000003',
      fiscalYear: year,
      invoiceDate: new Date(),
      customerId: customers[4].id,
      customerName: customers[4].name,
      customerVatNumber: customers[4].vatNumber,
      customerSdiCode: customers[4].sdiDestinationCode,
      status: InvoiceStatus.DRAFT,
      subtotalAmount: 1647,
      taxAmount: 0, // reverse charge intra-EU
      totalAmount: 1647,
      lines: [
        {
          description: 'Pompa P50 x 3 (reverse charge art. 17 DPR 633/1972)',
          quantity: 3,
          unitPrice: 549,
          ivaRate: 0,
          ivaNature: 'N6.1',
          lineTotal: 1647,
        },
      ],
    },
  ];
  for (const s of specs.slice(existing)) {
    await repo.save(repo.create({ ...s, tenantId }));
  }
  return (await repo.count({ where: { tenantId } }));
}

async function upsertJournalEntries(
  repo: Repository<JournalEntry>,
  accountRepo: Repository<ChartOfAccount>,
  tenantId: string,
): Promise<number> {
  const existing = await repo.count({ where: { tenantId } });
  if (existing >= 50) return existing;

  const receivable = await accountRepo.findOne({
    where: { tenantId, code: '01.04' },
  });
  const revenue = await accountRepo.findOne({
    where: { tenantId, code: '04.01.001' },
  });
  const iva = await accountRepo.findOne({
    where: { tenantId, code: '02.02.001' },
  });
  const bank = await accountRepo.findOne({
    where: { tenantId, code: '01.05.001' },
  });
  const materials = await accountRepo.findOne({
    where: { tenantId, code: '05.01' },
  });
  const supplier = await accountRepo.findOne({
    where: { tenantId, code: '02.01' },
  });

  if (!receivable || !revenue || !iva || !bank || !materials || !supplier) {
    return existing;
  }

  const base = new Date(new Date().getFullYear(), 0, 1);
  const target = 50 - existing;
  const days = [1, 3, 7, 10, 14, 18, 21, 25, 28];

  for (let i = 0; i < target; i++) {
    const mode = i % 5;
    const date = new Date(base.getTime());
    date.setDate(base.getDate() + (i * 7 + days[i % days.length]));
    let lines: JournalEntry['lines'];
    let description: string;
    let debitTotal: number;
    let creditTotal: number;

    if (mode === 0 || mode === 1) {
      // Invoice recorded: Crediti clienti DR vs Ricavi + IVA CR
      const taxable = 200 + (i % 20) * 35;
      const ivaValue = Number((taxable * 0.22).toFixed(2));
      const tot = Number((taxable + ivaValue).toFixed(2));
      lines = [
        {
          accountId: receivable.id,
          accountCode: receivable.code,
          debit: tot,
          credit: 0,
          description: 'Fattura cliente seed',
        },
        {
          accountId: revenue.id,
          accountCode: revenue.code,
          debit: 0,
          credit: taxable,
          description: 'Ricavi vendite seed',
        },
        {
          accountId: iva.id,
          accountCode: iva.code,
          debit: 0,
          credit: ivaValue,
          description: 'IVA 22% seed',
        },
      ];
      description = `Registrazione fattura seed ${String(i + 1).padStart(3, '0')}`;
      debitTotal = tot;
      creditTotal = taxable + ivaValue;
    } else if (mode === 2) {
      // Incasso da banca: Banca DR vs Crediti CR
      const amount = 300 + (i % 15) * 40;
      lines = [
        {
          accountId: bank.id,
          accountCode: bank.code,
          debit: amount,
          credit: 0,
          description: 'Incasso cliente',
        },
        {
          accountId: receivable.id,
          accountCode: receivable.code,
          debit: 0,
          credit: amount,
          description: 'Chiusura credito',
        },
      ];
      description = `Incasso cliente seed ${String(i + 1).padStart(3, '0')}`;
      debitTotal = amount;
      creditTotal = amount;
    } else if (mode === 3) {
      // Acquisto materie: Costi DR vs Debiti fornitori CR
      const amount = 150 + (i % 12) * 28;
      lines = [
        {
          accountId: materials.id,
          accountCode: materials.code,
          debit: amount,
          credit: 0,
          description: 'Acquisto materie prime',
        },
        {
          accountId: supplier.id,
          accountCode: supplier.code,
          debit: 0,
          credit: amount,
          description: 'Debito verso fornitore',
        },
      ];
      description = `Acquisto materie prime seed ${String(i + 1).padStart(3, '0')}`;
      debitTotal = amount;
      creditTotal = amount;
    } else {
      // Pagamento fornitore: Debiti DR vs Banca CR
      const amount = 180 + (i % 10) * 32;
      lines = [
        {
          accountId: supplier.id,
          accountCode: supplier.code,
          debit: amount,
          credit: 0,
          description: 'Pagamento fornitore',
        },
        {
          accountId: bank.id,
          accountCode: bank.code,
          debit: 0,
          credit: amount,
          description: 'Uscita banca c/c',
        },
      ];
      description = `Pagamento fornitore seed ${String(i + 1).padStart(3, '0')}`;
      debitTotal = amount;
      creditTotal = amount;
    }

    await repo.save(
      repo.create({
        tenantId,
        reference: `SEED-JE-${String(i + 1).padStart(3, '0')}`,
        entryDate: date,
        journal: ['generale', 'vendite', 'acquisti'][mode % 3],
        description,
        lines,
        totalDebit: Number(debitTotal.toFixed(2)),
        totalCredit: Number(creditTotal.toFixed(2)),
        isPosted: true,
      }),
    );
  }

  return (await repo.count({ where: { tenantId } }));
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
