import type { LeaveStatus } from '../entities/leave-request.entity';

/**
 * LeaveRequest FSM (R-D07; plan §31.1 Sprint 17 / S17.3).
 */
const TRANSITIONS: Record<LeaveStatus, ReadonlyArray<LeaveStatus>> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected', 'cancelled'],
  approved: ['cancelled'],
  rejected: [],
  cancelled: [],
};

export function canLeaveTransition(
  from: LeaveStatus,
  to: LeaveStatus,
): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertLeaveTransition(
  from: LeaveStatus,
  to: LeaveStatus,
): void {
  if (!canLeaveTransition(from, to)) {
    throw new Error(`Invalid LeaveRequest transition: ${from} → ${to}`);
  }
}

export function listLeaveTransitions(
  from: LeaveStatus,
): ReadonlyArray<LeaveStatus> {
  return TRANSITIONS[from] ?? [];
}
