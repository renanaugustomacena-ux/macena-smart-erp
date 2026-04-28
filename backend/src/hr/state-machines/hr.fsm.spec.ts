import {
  assertEmployeeTransition,
  canEmployeeTransition,
  listEmployeeTransitions,
} from './employee.fsm';
import {
  assertLeaveTransition,
  canLeaveTransition,
} from './leave-request.fsm';
import {
  assertAttendanceTransition,
  canAttendanceTransition,
} from './attendance.fsm';

describe('Employee FSM (S17.1)', () => {
  it('allows prospect → onboarding → active → terminated', () => {
    expect(canEmployeeTransition('prospect', 'onboarding')).toBe(true);
    expect(canEmployeeTransition('onboarding', 'active')).toBe(true);
    expect(canEmployeeTransition('active', 'terminated')).toBe(true);
  });

  it('allows early termination from prospect or onboarding', () => {
    expect(canEmployeeTransition('prospect', 'terminated')).toBe(true);
    expect(canEmployeeTransition('onboarding', 'terminated')).toBe(true);
  });

  it('rejects skipping onboarding', () => {
    expect(canEmployeeTransition('prospect', 'active')).toBe(false);
  });

  it('terminated is terminal', () => {
    expect(listEmployeeTransitions('terminated')).toEqual([]);
  });

  it('throws on invalid transition', () => {
    expect(() => assertEmployeeTransition('prospect', 'active')).toThrow(
      /prospect .* active/,
    );
  });
});

describe('LeaveRequest FSM (S17.3)', () => {
  it('allows draft → submitted → approved/rejected', () => {
    expect(canLeaveTransition('draft', 'submitted')).toBe(true);
    expect(canLeaveTransition('submitted', 'approved')).toBe(true);
    expect(canLeaveTransition('submitted', 'rejected')).toBe(true);
  });

  it('allows approved → cancelled (early return / withdrawal)', () => {
    expect(canLeaveTransition('approved', 'cancelled')).toBe(true);
  });

  it('rejected is terminal', () => {
    expect(canLeaveTransition('rejected', 'submitted')).toBe(false);
  });

  it('throws on invalid transition', () => {
    expect(() => assertLeaveTransition('rejected', 'approved')).toThrow();
  });
});

describe('Attendance FSM (S17.2)', () => {
  it('allows open → closed and open → auto_closed', () => {
    expect(canAttendanceTransition('open', 'closed')).toBe(true);
    expect(canAttendanceTransition('open', 'auto_closed')).toBe(true);
  });

  it('terminal states stay terminal', () => {
    expect(canAttendanceTransition('closed', 'open')).toBe(false);
    expect(canAttendanceTransition('auto_closed', 'closed')).toBe(false);
    expect(() => assertAttendanceTransition('closed', 'open')).toThrow();
  });
});
