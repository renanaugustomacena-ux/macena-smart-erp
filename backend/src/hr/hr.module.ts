import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { Attendance } from './entities/attendance.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import {
  Ccnl,
  CcnlLeaveEntitlement,
  CcnlPayGrade,
} from './entities/ccnl.entity';
import { EmployeeService } from './employee.service';
import { AttendanceService } from './attendance.service';
import { LeaveRequestService } from './leave-request.service';
import { CcnlService } from './ccnl.service';
import { HrController } from './hr.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      Attendance,
      LeaveRequest,
      Ccnl,
      CcnlPayGrade,
      CcnlLeaveEntitlement,
    ]),
  ],
  controllers: [HrController],
  providers: [
    EmployeeService,
    AttendanceService,
    LeaveRequestService,
    CcnlService,
  ],
  exports: [
    EmployeeService,
    AttendanceService,
    LeaveRequestService,
    CcnlService,
  ],
})
export class HrModule {}
