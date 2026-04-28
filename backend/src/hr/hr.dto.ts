import {
  IsArray,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type {
  AttendanceLocation,
  AttendanceStatus,
} from './entities/attendance.entity';
import type {
  EmployeeContractType,
  EmployeeStatus,
} from './entities/employee.entity';
import type { LeaveStatus, LeaveType } from './entities/leave-request.entity';

const CONTRACT_TYPES: EmployeeContractType[] = [
  'indeterminato',
  'determinato',
  'apprendistato',
  'somministrazione',
  'cococo',
  'stage',
  'collaborazione_occasionale',
];

const EMPLOYEE_STATUSES: EmployeeStatus[] = [
  'prospect',
  'onboarding',
  'active',
  'terminated',
];

const ATTENDANCE_LOCATIONS: AttendanceLocation[] = [
  'office',
  'remote',
  'site',
  'travel',
  'other',
];

const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'open',
  'closed',
  'auto_closed',
];

const LEAVE_TYPES: LeaveType[] = [
  'ferie',
  'permesso_retribuito',
  'permesso_non_retribuito',
  'malattia',
  'congedo_maternita',
  'congedo_paternita',
  'congedo_parentale',
  'congedo_matrimoniale',
  'lutto',
  'l104',
  'altro',
];

const LEAVE_STATUSES: LeaveStatus[] = [
  'draft',
  'submitted',
  'approved',
  'rejected',
  'cancelled',
];

// ─── Employee ───────────────────────────────────────────────────

export class CreateEmployeeDto {
  @IsString() @Length(1, 100) firstName: string;
  @IsString() @Length(1, 100) lastName: string;

  @IsOptional() @IsString() @Length(11, 16) fiscalCode?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Length(3, 30) phone?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() @Length(1, 100) placeOfBirth?: string;
  @IsOptional() @IsString() @Length(2, 2) nationality?: string;

  @IsOptional() residenceAddress?: Record<string, unknown>;

  @IsOptional() @IsIn(CONTRACT_TYPES) contractType?: EmployeeContractType;
  @IsOptional() @IsString() @Length(1, 50) ccnlCode?: string;
  @IsOptional() @IsString() @Length(1, 50) payGradeCode?: string;

  @IsOptional() @IsNumberString() weeklyHours?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) monthlyWageCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) hourlyWageCents?: number;

  @IsOptional() @IsDateString() hireDate?: string;
  @IsOptional() @IsUUID() managerEmployeeId?: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateEmployeeDto {
  @IsOptional() @IsString() @Length(1, 100) firstName?: string;
  @IsOptional() @IsString() @Length(1, 100) lastName?: string;
  @IsOptional() @IsString() @Length(11, 16) fiscalCode?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Length(3, 30) phone?: string;
  @IsOptional() residenceAddress?: Record<string, unknown>;
  @IsOptional() @IsIn(CONTRACT_TYPES) contractType?: EmployeeContractType;
  @IsOptional() @IsString() @Length(1, 50) ccnlCode?: string;
  @IsOptional() @IsString() @Length(1, 50) payGradeCode?: string;
  @IsOptional() @IsNumberString() weeklyHours?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) monthlyWageCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) hourlyWageCents?: number;
  @IsOptional() @IsUUID() managerEmployeeId?: string;
  @IsOptional() @IsString() notes?: string;
}

export class EmployeeOnboardDto {
  @IsOptional() @IsDateString() hireDate?: string;
}

export class EmployeeActivateDto {
  @IsOptional() @IsDateString() hireDate?: string;
}

export class EmployeeTerminateDto {
  @IsDateString() terminationDate: string;
  @IsString() @Length(1, 1000) terminationReason: string;
}

export class ListEmployeesQueryDto {
  @IsOptional() @IsIn(EMPLOYEE_STATUSES) status?: EmployeeStatus;
  @IsOptional() @IsIn(CONTRACT_TYPES) contractType?: EmployeeContractType;
  @IsOptional() @IsString() ccnlCode?: string;
}

// ─── Attendance ─────────────────────────────────────────────────

export class ClockInDto {
  @IsUUID() employeeId: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsISO8601() at?: string;
  @IsOptional() @IsIn(ATTENDANCE_LOCATIONS) location?: AttendanceLocation;
  @IsOptional() @IsString() @Length(1, 100) locationLabel?: string;
}

export class ClockOutDto {
  @IsUUID() employeeId: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsISO8601() at?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) breakMinutes?: number;
  @IsOptional() @IsString() notes?: string;
}

export class ListAttendancesQueryDto {
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @IsIn(ATTENDANCE_STATUSES) status?: AttendanceStatus;
}

// ─── LeaveRequest ───────────────────────────────────────────────

export class CreateLeaveRequestDto {
  @IsUUID() employeeId: string;
  @IsIn(LEAVE_TYPES) leaveType: LeaveType;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsNumberString() daysRequested: string;
  @IsOptional() @IsString() reason?: string;

  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : typeof value === 'string' && value.length > 0
        ? value.split(',').map((s) => s.trim())
        : undefined,
  )
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class DecideLeaveRequestDto {
  @IsOptional() @IsString() @Length(1, 1000) reason?: string;
}

export class ListLeaveRequestsQueryDto {
  @IsOptional() @IsUUID() employeeId?: string;
  @IsOptional() @IsIn(LEAVE_STATUSES) status?: LeaveStatus;
  @IsOptional() @IsIn(LEAVE_TYPES) leaveType?: LeaveType;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
}

// ─── CCNL ───────────────────────────────────────────────────────

export class ListPayGradesQueryDto {
  @IsString() @Length(1, 50) ccnlCode: string;
}

