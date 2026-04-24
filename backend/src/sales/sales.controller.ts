import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { SalesService } from './sales.service';
import { SalesOrderStatus } from './sales.entity';
import { CreateCustomerDto, CreateSalesOrderDto } from './sales.dto';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';

@ApiTags('Sales')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // ─── Customers ─────────────────────────────────────────────────

  @Post('customers')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new customer (anagrafica cliente)' })
  async createCustomer(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCustomerDto,
  ) {
    return this.salesService.createCustomer(req.user.tenantId, dto);
  }

  @Get('customers')
  @ApiOperation({ summary: 'List customers with search and pagination' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listCustomers(
    @Request() req: { user: { tenantId: string } },
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.salesService.listCustomers(req.user.tenantId, {
      search,
      page,
      limit,
    });
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Get customer details' })
  @ApiParam({ name: 'id', description: 'Customer UUID' })
  async getCustomer(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.getCustomer(req.user.tenantId, id);
  }

  // ─── Sales Orders ──────────────────────────────────────────────

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new sales order' })
  async createOrder(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateSalesOrderDto,
  ) {
    return this.salesService.createSalesOrder(req.user.tenantId, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List sales orders with status filter' })
  @ApiQuery({ name: 'status', required: false, enum: SalesOrderStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listOrders(
    @Request() req: { user: { tenantId: string } },
    @Query('status') status?: SalesOrderStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.salesService.listSalesOrders(req.user.tenantId, {
      status,
      page,
      limit,
    });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get sales order by ID' })
  @ApiParam({ name: 'id', description: 'Sales order UUID' })
  @ApiResponse({
    status: 404,
    description: 'Returned on cross-tenant access as well (tenant isolation)',
  })
  async getOrder(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.getSalesOrder(req.user.tenantId, id);
  }

  @Patch('orders/:id/confirm')
  @ApiOperation({
    summary:
      'Confirm a draft sales order (reserves stock for every inventory line)',
  })
  @ApiParam({ name: 'id', description: 'Sales order UUID' })
  async confirmOrder(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.confirmSalesOrder(req.user.tenantId, id);
  }

  @Patch('orders/:id/cancel')
  @ApiOperation({
    summary:
      'Cancel a sales order (releases any stock reservation)',
  })
  @ApiParam({ name: 'id', description: 'Sales order UUID' })
  async cancelOrder(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.cancelSalesOrder(req.user.tenantId, id);
  }

  @Patch('orders/:id/ship')
  @ApiOperation({
    summary:
      'Ship a confirmed sales order (decrements on-hand + reserved stock)',
  })
  @ApiParam({ name: 'id', description: 'Sales order UUID' })
  async shipOrder(
    @Request() req: { user: { tenantId: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.salesService.shipSalesOrder(req.user.tenantId, id);
  }
}
