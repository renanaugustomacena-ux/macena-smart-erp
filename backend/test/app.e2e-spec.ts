import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('SmartERP API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Health Check ────────────────────────────────────────────────

  describe('Health (GET /api/health)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(['ok', 'degraded']).toContain(res.body.status);
          expect(res.body.service).toBe('smarterp-backend');
          expect(res.body.time).toBeDefined();
          expect(res.body.timestamp).toBeDefined();
          expect(typeof res.body.uptime_seconds).toBe('number');
          expect(res.body.dependencies).toBeDefined();
          expect(res.body.dependencies.postgres).toBeDefined();
          expect(res.body.dependencies.redis).toBeDefined();
        });
    });

    it('should return readiness status', () => {
      return request(app.getHttpServer())
        .get('/api/health/ready')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ready');
        });
    });

    it('should return liveness status', () => {
      return request(app.getHttpServer())
        .get('/api/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('alive');
        });
    });
  });

  // ─── Authentication ──────────────────────────────────────────────

  describe('Auth (POST /api/auth)', () => {
    const testUser = {
      firstName: 'Mario',
      lastName: 'Rossi',
      email: `test-${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      companyName: 'Test Azienda SRL',
      phone: '+39 045 123 4567',
      partitaIva: '12345678901',
    };

    let accessToken: string;

    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body.message).toBe('Registration successful');
          expect(res.body.user.email).toBe(testUser.email);
          expect(res.body.user.firstName).toBe(testUser.firstName);
          expect(res.body.user).not.toHaveProperty('passwordHash');
        });
    });

    it('should reject duplicate registration', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(409);
    });

    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.refreshToken).toBeDefined();
          expect(typeof res.body.expiresIn).toBe('number');
          expect(res.body.user.email).toBe(testUser.email);
          accessToken = res.body.accessToken;
        });
    });

    it('should reject login with invalid password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword',
        })
        .expect(401);
    });

    it('should get user profile with valid token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe(testUser.email);
          expect(res.body.companyName).toBe(testUser.companyName);
        });
    });

    it('should reject profile access without token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/profile')
        .expect(401);
    });
  });

  // ─── Inventory ───────────────────────────────────────────────────

  describe('Inventory (CRUD /api/inventory)', () => {
    let accessToken: string;
    let productId: string;
    let warehouseId: string;

    beforeAll(async () => {
      // Register and login to get token
      const email = `inv-test-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'Inventory',
          email,
          password: 'TestPass123!',
          companyName: 'Test Magazzino SRL',
        });

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'TestPass123!' });

      accessToken = loginRes.body.accessToken;
    });

    it('should create a product', () => {
      return request(app.getHttpServer())
        .post('/api/inventory/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          sku: 'MAT-001',
          name: 'Acciaio Inox 304',
          category: 'raw_material',
          unitOfMeasure: 'kg',
          unitCost: 3.50,
          sellingPrice: 5.00,
          minimumStock: 100,
          reorderPoint: 200,
          reorderQuantity: 500,
          supplier: 'Forniture Metalli Verona',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.sku).toBe('MAT-001');
          expect(res.body.name).toBe('Acciaio Inox 304');
          productId = res.body.id;
        });
    });

    it('should list products', () => {
      return request(app.getHttpServer())
        .get('/api/inventory/products')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeInstanceOf(Array);
          expect(res.body.total).toBeGreaterThanOrEqual(1);
          expect(res.body.page).toBe(1);
        });
    });

    it('should create a warehouse', () => {
      return request(app.getHttpServer())
        .post('/api/inventory/warehouses')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          code: 'MAG-01',
          name: 'Magazzino Principale Mozzecane',
          address: 'Via Industriale 15',
          city: 'Mozzecane',
          postalCode: '37060',
          province: 'VR',
          contactPerson: 'Luigi Bianchi',
          capacitySquareMeters: 2500,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.code).toBe('MAG-01');
          warehouseId = res.body.id;
        });
    });

    it('should record a stock inbound movement', () => {
      return request(app.getHttpServer())
        .post('/api/inventory/stock/movements')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productId,
          movementType: 'inbound',
          quantity: 500,
          destinationWarehouseId: warehouseId,
          referenceNumber: 'DDT-2024-001',
          notes: 'Consegna da Forniture Metalli Verona',
          performedBy: 'Mario Rossi',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.quantity).toBe(500);
          expect(res.body.movementType).toBe('inbound');
        });
    });

    it('should get stock levels', () => {
      return request(app.getHttpServer())
        .get('/api/inventory/stock')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeInstanceOf(Array);
        });
    });

    it('should get inventory valuation', () => {
      return request(app.getHttpServer())
        .get('/api/inventory/stock/valuation')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.totalValue).toBeDefined();
          expect(res.body.byCategory).toBeDefined();
        });
    });
  });

  // ─── Production ──────────────────────────────────────────────────

  describe('Production (CRUD /api/production)', () => {
    let accessToken: string;
    let productionOrderId: string;

    beforeAll(async () => {
      const email = `prod-test-${Date.now()}@example.com`;
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          firstName: 'Test',
          lastName: 'Production',
          email,
          password: 'TestPass123!',
          companyName: 'Test Produzione SRL',
        });

      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'TestPass123!' });

      accessToken = loginRes.body.accessToken;
    });

    it('should create a production order', () => {
      return request(app.getHttpServer())
        .post('/api/production/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          productName: 'Componente Meccanico A-100',
          quantityPlanned: 1000,
          priority: 'high',
          plannedStartDate: '2024-02-01',
          plannedEndDate: '2024-02-15',
          notes: 'Ordine urgente per cliente Verona Meccanica',
          customerReference: 'CLI-2024-045',
          estimatedCost: 15000,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.orderNumber).toMatch(/^PO-/);
          expect(res.body.status).toBe('draft');
          productionOrderId = res.body.id;
        });
    });

    it('should update production order status', () => {
      return request(app.getHttpServer())
        .patch(`/api/production/orders/${productionOrderId}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'planned' })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('planned');
        });
    });

    it('should create a work order', () => {
      return request(app.getHttpServer())
        .post(`/api/production/orders/${productionOrderId}/work-orders`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          operationName: 'Taglio Laser',
          workCenter: 'CNC-01',
          sequenceNumber: 1,
          estimatedDurationHours: 8,
          assignedTo: 'Giuseppe Verdi',
          instructions: 'Utilizzare programma CNC #A100-TAGLIO',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.workOrderNumber).toMatch(/^WO-/);
          expect(res.body.operationName).toBe('Taglio Laser');
        });
    });

    it('should get production dashboard', () => {
      return request(app.getHttpServer())
        .get('/api/production/dashboard')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(typeof res.body.activeOrders).toBe('number');
          expect(typeof res.body.efficiency).toBe('number');
        });
    });
  });
});
