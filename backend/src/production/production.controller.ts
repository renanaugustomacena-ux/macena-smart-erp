import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
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

import { ProductionService, ProductionOrderStatus } from './production.service';
import {
  CreateProductionOrderDto,
  CreateWorkOrderDto,
  UpdateProductionOrderStatusDto,
  UpdateWorkOrderStatusDto,
} from './production.dto';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

@ApiTags('Production')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  // ─── Production Orders ─────────────────────────────────────────

  @Post('orders')
  @ApiOperation({ summary: 'Create a new production order' })
  async createProductionOrder(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateProductionOrderDto,
  ) {
    return this.productionService.createProductionOrder(req.user.tenantId, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List production orders with filtering' })
  @ApiQuery({ name: 'status', required: false, enum: ProductionOrderStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getProductionOrders(
    @Request() req: { user: { tenantId: string } },
    @Query('status') status?: ProductionOrderStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productionService.getProductionOrders(
      req.user.tenantId,
      status,
      page,
      limit,
    );
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get production order details with work orders' })
  @ApiParam({ name: 'id', description: 'Production order UUID' })
  @ApiResponse({
    status: 404,
    description: 'Production order not found or belongs to another tenant',
  })
  async getProductionOrder(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.productionService.getProductionOrderById(
      req.user.tenantId,
      id,
    );
  }

  @Patch('orders/:id/status')
  @ApiOperation({
    summary:
      'Update production order status (BOM expansion on IN_PROGRESS transition)',
  })
  @ApiParam({ name: 'id', description: 'Production order UUID' })
  async updateProductionOrderStatus(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProductionOrderStatusDto,
  ) {
    return this.productionService.updateProductionOrderStatus(
      req.user.tenantId,
      id,
      body.status,
    );
  }

  // ─── Work Orders ───────────────────────────────────────────────

  @Post('orders/:orderId/work-orders')
  @ApiOperation({ summary: 'Create a work order for a production order' })
  @ApiParam({ name: 'orderId', description: 'Parent production order UUID' })
  async createWorkOrder(
    @Request() req: { user: { tenantId: string } },
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateWorkOrderDto,
  ) {
    return this.productionService.createWorkOrder(
      req.user.tenantId,
      orderId,
      dto,
    );
  }

  @Get('work-orders')
  @ApiOperation({ summary: 'List all work orders across production orders' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'workCenter', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getWorkOrders(
    @Request() req: { user: { tenantId: string } },
    @Query('status') status?: string,
    @Query('workCenter') workCenter?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productionService.getWorkOrders(
      req.user.tenantId,
      status,
      workCenter,
      page,
      limit,
    );
  }

  @Patch('work-orders/:id/status')
  @ApiOperation({ summary: 'Update work order status (start, complete, etc.)' })
  @ApiParam({ name: 'id', description: 'Work order UUID' })
  async updateWorkOrderStatus(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkOrderStatusDto,
  ) {
    return this.productionService.updateWorkOrderStatus(
      req.user.tenantId,
      id,
      dto,
    );
  }

  // ─── Dashboard & Analytics ─────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Get production dashboard summary' })
  async getProductionDashboard(@Request() req: { user: { tenantId: string } }) {
    return this.productionService.getDashboardMetrics(req.user.tenantId);
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Get production schedule for date range' })
  @ApiQuery({ name: 'startDate', required: true, type: String })
  @ApiQuery({ name: 'endDate', required: true, type: String })
  async getProductionSchedule(
    @Request() req: { user: { tenantId: string } },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.productionService.getProductionSchedule(
      req.user.tenantId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
