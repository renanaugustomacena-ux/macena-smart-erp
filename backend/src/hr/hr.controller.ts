import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { EmployeeService } from './employee.service';
import { AttendanceService } from './attendance.service';
import { LeaveRequestService } from './leave-request.service';
import { CcnlService } from './ccnl.service';
import {
  ClockInDto,
  ClockOutDto,
  CreateEmployeeDto,
  CreateLeaveRequestDto,
  DecideLeaveRequestDto,
  EmployeeActivateDto,
  EmployeeOnboardDto,
  EmployeeTerminateDto,
  ListAttendancesQueryDto,
  ListEmployeesQueryDto,
  ListLeaveRequestsQueryDto,
  UpdateEmployeeDto,
} from './hr.dto';

interface RequestWithUser {
  user: { id: string; tenantId: string; role: string };
}

@ApiTags('HR-lite')
@ApiBearerAuth('JWT-auth')
@Controller('hr')
@UseGuards(AuthGuard('jwt'), TenantScopeGuard)
export class HrController {
  constructor(
    private readonly employeeSvc: EmployeeService,
    private readonly attendanceSvc: AttendanceService,
    private readonly leaveSvc: LeaveRequestService,
    private readonly ccnlSvc: CcnlService,
  ) {}

  // ─── Employees (S17.1) ──────────────────────────────────────

  @Post('employees')
  @ApiOperation({ summary: 'Create an Employee in PROSPECT status' })
  async createEmployee(
    @Req() req: RequestWithUser,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeeSvc.create(req.user.tenantId, dto);
  }

  @Get('employees')
  @ApiOperation({ summary: 'List employees (filterable)' })
  async listEmployees(
    @Req() req: RequestWithUser,
    @Query() query: ListEmployeesQueryDto,
  ) {
    return this.employeeSvc.list(req.user.tenantId, query);
  }

  @Get('employees/:id')
  @ApiOperation({ summary: 'Get an Employee by id' })
  async getEmployee(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.employeeSvc.get(req.user.tenantId, id);
  }

  @Patch('employees/:id')
  @ApiOperation({ summary: 'Update Employee anagrafica' })
  async updateEmployee(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeeSvc.update(req.user.tenantId, id, dto);
  }

  @Post('employees/:id/onboard')
  @ApiOperation({ summary: 'Move Employee from prospect → onboarding' })
  async onboardEmployee(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EmployeeOnboardDto,
  ) {
    return this.employeeSvc.startOnboarding(req.user.tenantId, id, dto);
  }

  @Post('employees/:id/activate')
  @ApiOperation({ summary: 'Move Employee from onboarding → active' })
  async activateEmployee(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EmployeeActivateDto,
  ) {
    return this.employeeSvc.activate(req.user.tenantId, id, dto);
  }

  @Post('employees/:id/terminate')
  @ApiOperation({ summary: 'Move Employee to terminated' })
  async terminateEmployee(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EmployeeTerminateDto,
  ) {
    return this.employeeSvc.terminate(req.user.tenantId, id, dto);
  }

  // ─── Attendance (S17.2) ─────────────────────────────────────

  @Post('attendance/clock-in')
  @ApiOperation({ summary: 'Clock in for the calling employee (idempotent per day)' })
  async clockIn(@Req() req: RequestWithUser, @Body() dto: ClockInDto) {
    return this.attendanceSvc.clockIn(req.user.tenantId, req.user.id, dto);
  }

  @Post('attendance/clock-out')
  @ApiOperation({ summary: 'Clock out — closes the daily attendance row + computes worked hours' })
  async clockOut(@Req() req: RequestWithUser, @Body() dto: ClockOutDto) {
    return this.attendanceSvc.clockOut(req.user.tenantId, dto);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'List attendance rows (manager view; filterable by employee + date range)' })
  async listAttendance(
    @Req() req: RequestWithUser,
    @Query() query: ListAttendancesQueryDto,
  ) {
    return this.attendanceSvc.list(req.user.tenantId, query);
  }

  // ─── Leave (S17.3) ──────────────────────────────────────────

  @Post('leaves')
  @ApiOperation({ summary: 'Create a LeaveRequest (DRAFT)' })
  async createLeave(
    @Req() req: RequestWithUser,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.leaveSvc.create(req.user.tenantId, dto);
  }

  @Get('leaves')
  @ApiOperation({ summary: 'List leave requests (filterable)' })
  async listLeaves(
    @Req() req: RequestWithUser,
    @Query() query: ListLeaveRequestsQueryDto,
  ) {
    return this.leaveSvc.list(req.user.tenantId, query);
  }

  @Get('leaves/:id')
  @ApiOperation({ summary: 'Get a LeaveRequest' })
  async getLeave(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaveSvc.get(req.user.tenantId, id);
  }

  @Post('leaves/:id/submit')
  @ApiOperation({ summary: 'Employee submits a draft LeaveRequest' })
  async submitLeave(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leaveSvc.submit(req.user.tenantId, id);
  }

  @Post('leaves/:id/approve')
  @ApiOperation({ summary: 'Manager approves a submitted LeaveRequest' })
  async approveLeave(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideLeaveRequestDto,
  ) {
    return this.leaveSvc.approve(req.user.tenantId, id, req.user.id, dto);
  }

  @Post('leaves/:id/reject')
  @ApiOperation({ summary: 'Manager rejects a submitted LeaveRequest' })
  async rejectLeave(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideLeaveRequestDto,
  ) {
    return this.leaveSvc.reject(req.user.tenantId, id, req.user.id, dto);
  }

  @Post('leaves/:id/cancel')
  @ApiOperation({
    summary:
      'Cancel a LeaveRequest (employee from draft/submitted; manager from approved)',
  })
  async cancelLeave(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideLeaveRequestDto,
  ) {
    return this.leaveSvc.cancel(req.user.tenantId, id, req.user.id, dto);
  }

  // ─── CCNL reference (S17.4) ────────────────────────────────

  @Get('ccnls')
  @ApiOperation({ summary: 'List supported CCNLs (global reference data)' })
  async listCcnls() {
    return this.ccnlSvc.listCcnls();
  }

  @Get('ccnls/:code')
  @ApiOperation({ summary: 'Get a CCNL by code' })
  async getCcnl(@Param('code') code: string) {
    return this.ccnlSvc.getCcnl(code);
  }

  @Get('ccnls/:code/pay-grades')
  @ApiOperation({ summary: 'List pay grades (livelli) for a CCNL' })
  async listPayGrades(@Param('code') code: string) {
    return this.ccnlSvc.listPayGrades(code);
  }

  @Get('ccnls/:code/leave-entitlements')
  @ApiOperation({ summary: 'List leave entitlements (ferie/permessi) for a CCNL' })
  async listLeaveEntitlements(@Param('code') code: string) {
    return this.ccnlSvc.listLeaveEntitlements(code);
  }
}
