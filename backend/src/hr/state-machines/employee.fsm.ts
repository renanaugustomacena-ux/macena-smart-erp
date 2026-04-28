import type { EmployeeStatus } from '../entities/employee.entity';

/**
 * Employee status FSM (R-D07; plan §31.1 Sprint 17 / S17.1).
 */
const TRANSITIONS: Record<EmployeeStatus, ReadonlyArray<EmployeeStatus>> = {
  prospect: ['onboarding', 'terminated'],
  onboarding: ['active', 'terminated'],
  active: ['terminated'],
  terminated: [],
};

export function canEmployeeTransition(
  from: EmployeeStatus,
  to: EmployeeStatus,
): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertEmployeeTransition(
  from: EmployeeStatus,
  to: EmployeeStatus,
): void {
  if (!canEmployeeTransition(from, to)) {
    throw new Error(`Invalid Employee transition: ${from} → ${to}`);
  }
}

export function listEmployeeTransitions(
  from: EmployeeStatus,
): ReadonlyArray<EmployeeStatus> {
  return TRANSITIONS[from] ?? [];
}
