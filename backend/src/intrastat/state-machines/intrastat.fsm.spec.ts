import {
  assertIntrastatTransition,
  canIntrastatTransition,
  listIntrastatTransitions,
} from './intrastat.fsm';

describe('IntrastatDeclaration FSM (S16.2)', () => {
  it('allows draft → generated', () => {
    expect(canIntrastatTransition('draft', 'generated')).toBe(true);
  });

  it('allows generated → submitted, accepted/rejected', () => {
    expect(canIntrastatTransition('generated', 'submitted')).toBe(true);
    expect(canIntrastatTransition('submitted', 'accepted')).toBe(true);
    expect(canIntrastatTransition('submitted', 'rejected')).toBe(true);
  });

  it('allows generated → draft (re-open)', () => {
    expect(canIntrastatTransition('generated', 'draft')).toBe(true);
  });

  it('rejects draft → submitted (must generate first)', () => {
    expect(canIntrastatTransition('draft', 'submitted')).toBe(false);
  });

  it('rejects accepted/rejected as terminal', () => {
    expect(listIntrastatTransitions('accepted')).toEqual([]);
    expect(listIntrastatTransitions('rejected')).toEqual([]);
    expect(canIntrastatTransition('accepted', 'submitted')).toBe(false);
    expect(canIntrastatTransition('rejected', 'submitted')).toBe(false);
  });

  it('throws on invalid transition', () => {
    expect(() => assertIntrastatTransition('draft', 'submitted')).toThrow(
      /draft .* submitted/,
    );
  });
});
