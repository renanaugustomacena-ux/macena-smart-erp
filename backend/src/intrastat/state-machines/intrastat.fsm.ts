import type { IntrastatDeclarationStatus } from '../entities/intrastat-declaration.entity';

/**
 * IntrastatDeclaration FSM (R-D07; plan §31.1 Sprint 16 / S16.2).
 *
 *   draft     ──► generated
 *   generated ──► submitted
 *   generated ──► draft        (re-open while still pre-submission)
 *   submitted ──► accepted | rejected
 *
 *   accepted, rejected         — terminal
 */
const TRANSITIONS: Record<
  IntrastatDeclarationStatus,
  ReadonlyArray<IntrastatDeclarationStatus>
> = {
  draft: ['generated'],
  generated: ['submitted', 'draft'],
  submitted: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
};

export function canIntrastatTransition(
  from: IntrastatDeclarationStatus,
  to: IntrastatDeclarationStatus,
): boolean {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function assertIntrastatTransition(
  from: IntrastatDeclarationStatus,
  to: IntrastatDeclarationStatus,
): void {
  if (!canIntrastatTransition(from, to)) {
    throw new Error(
      `Invalid Intrastat transition: ${from} → ${to}`,
    );
  }
}

export function listIntrastatTransitions(
  from: IntrastatDeclarationStatus,
): ReadonlyArray<IntrastatDeclarationStatus> {
  return TRANSITIONS[from] ?? [];
}
