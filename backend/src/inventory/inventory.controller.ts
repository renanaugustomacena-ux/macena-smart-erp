import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { InventoryService, ProductFilter } from './inventory.service';
import { ProductCategory } from './inventory.entity';
import {
  CreateProductDto,
  CreateWarehouseDto,
  StockMovementCreateDto,
  UpdateProductDto,
} from './inventory.dto';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

@ApiTags('Inventory')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ─── Products ──────────────────────────────────────────────────

  @Post('products')
  @ApiOperation({ summary: 'Create a new product' })
  async createProduct(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateProductDto,
  ) {
    return this.inventoryService.createProduct(req.user.tenantId, dto);
  }

  @Get('products')
  @ApiOperation({ summary: 'List products with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false, enum: ProductCategory })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async getProducts(
    @Request() req: { user: { tenantId: string } },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('category') category?: ProductCategory,
    @Query('search') search?: string,
    @Query('isActive') isActive?: boolean,
  ) {
    const filter: ProductFilter = {
      tenantId: req.user.tenantId,
      page,
      limit,
      category,
      search,
      isActive,
    };
    return this.inventoryService.getProducts(filter);
  }

  @Get('products/low-stock')
  @ApiOperation({ summary: 'Get products below reorder point' })
  async getLowStockProducts(@Request() req: { user: { tenantId: string } }) {
    return this.inventoryService.getLowStockProducts(req.user.tenantId);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get product by ID with stock levels' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  async getProduct(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.getProductById(req.user.tenantId, id);
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Update product details' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  async updateProduct(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.inventoryService.updateProduct(req.user.tenantId, id, dto);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a product (soft delete)' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  async deleteProduct(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.deleteProduct(req.user.tenantId, id);
  }

  // ─── Warehouses ────────────────────────────────────────────────

  @Post('warehouses')
  @ApiOperation({ summary: 'Create a new warehouse' })
  async createWarehouse(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.inventoryService.createWarehouse(req.user.tenantId, dto);
  }

  @Get('warehouses')
  @ApiOperation({ summary: 'List all active warehouses' })
  async getWarehouses(@Request() req: { user: { tenantId: string } }) {
    return this.inventoryService.getWarehouses(req.user.tenantId);
  }

  @Get('warehouses/:id')
  @ApiOperation({ summary: 'Get warehouse details with stock levels' })
  @ApiParam({ name: 'id', description: 'Warehouse UUID' })
  async getWarehouse(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inventoryService.getWarehouseById(req.user.tenantId, id);
  }

  @Put('warehouses/:id')
  @ApiOperation({ summary: 'Update warehouse details' })
  @ApiParam({ name: 'id', description: 'Warehouse UUID' })
  async updateWarehouse(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWarehouseDto,
  ) {
    return this.inventoryService.updateWarehouse(req.user.tenantId, id, dto);
  }

  // ─── Stock ─────────────────────────────────────────────────────

  @Get('stock')
  @ApiOperation({ summary: 'Get current stock levels across all warehouses' })
  @ApiQuery({ name: 'warehouseId', required: false, type: String })
  async getStockLevels(
    @Request() req: { user: { tenantId: string } },
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventoryService.getStockLevels(
      req.user.tenantId,
      warehouseId,
    );
  }

  @Post('stock/movements')
  @ApiOperation({
    summary: 'Record a stock movement (inbound, outbound, transfer, adjust)',
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400, description: 'Insufficient stock' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async recordStockMovement(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: StockMovementCreateDto,
  ) {
    return this.inventoryService.recordStockMovement(req.user.tenantId, dto);
  }

  @Get('stock/movements')
  @ApiOperation({ summary: 'Get stock movement history' })
  @ApiQuery({ name: 'productId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getStockMovements(
    @Request() req: { user: { tenantId: string } },
    @Query('productId') productId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getStockMovements(
      req.user.tenantId,
      productId,
      page,
      limit,
    );
  }

  @Get('stock/valuation')
  @ApiOperation({ summary: 'Get inventory valuation summary' })
  async getInventoryValuation(@Request() req: { user: { tenantId: string } }) {
    return this.inventoryService.getInventoryValuation(req.user.tenantId);
  }
}
