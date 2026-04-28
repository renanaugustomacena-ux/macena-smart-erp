import type { AttendanceStatus } from '../entities/attendance.entity';

/**
 * Attendance FSM (R-D07; plan §31.1 Sprint 17 / S17.2).
 */
const TRANSITIONS: Record<AttendanceStatus, ReadonlyArray<AttendanceStatus>> = {
  open: ['closed', 'auto_closed'],
  closed: [],
  auto_closed: [],
};

export function canAttendanceTransition(
  from: AttendanceStatus,
  to: AttendanceStatus,
): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertAttendanceTransition(
  from: AttendanceStatus,
  to: AttendanceStatus,
): void {
  if (!canAttendanceTransition(from, to)) {
    throw new Error(`Invalid Attendance transition: ${from} → ${to}`);
  }
}
