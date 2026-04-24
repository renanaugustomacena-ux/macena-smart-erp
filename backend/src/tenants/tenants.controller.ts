import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
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
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto } from './tenants.dto';

@ApiTags('Tenants')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthGuard('jwt'))
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tenant (admin-only in production)' })
  @ApiResponse({ status: 201, description: 'Tenant created' })
  @ApiResponse({ status: 409, description: 'Partita IVA already registered' })
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get the current authenticated user\'s tenant' })
  @ApiResponse({ status: 200, description: 'Active tenant details' })
  async getCurrent(@Request() req: { user: { tenantId: string } }) {
    return this.tenantsService.findById(req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID (only callable for the caller\'s own tenant)' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found or cross-tenant' })
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.tenantsService.findByIdForCaller(id, req.user.tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant profile, plan, or status (own tenant only)' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  @ApiResponse({ status: 403, description: 'Cross-tenant update attempt' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: { tenantId: string } },
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.updateForCaller(id, req.user.tenantId, dto);
  }
}
