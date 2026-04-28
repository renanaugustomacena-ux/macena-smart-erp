#!/usr/bin/env bash
# Sprint 1 demo orchestrator (Story S1.8).
#
# Runs the proof bundle for the Sprint 1 demo subject:
# "cross-tenant attack rejected at all four layers (JWT, TenantScopeGuard,
# service-layer R-D02, Postgres RLS)" plus the supporting capabilities
# delivered in Sprint 1 (Argon2id round-trip, account lockout, RFC 7807
# envelope, DataClassification decorator, tenantId-first index audit).
#
# Run from the repo root or backend/. Exits non-zero if any check fails.

set -euo pipefail

if [ -d "backend" ]; then
  cd backend
fi

echo
echo "=============================================================="
echo " SmartERP — Sprint 1 demo"
echo " Subject: cross-tenant attack rejected at all 4 layers."
echo "=============================================================="
echo

step () {
  echo
  echo "------------------------------------------------------------"
  echo " $1"
  echo "------------------------------------------------------------"
}

step "1/5 — R-D02 ESLint rule violations on the codebase (must be 0)"
# Only count actual ESLint findings ("warning" or "error" rows that name the
# rule), not the rule-test stdout-banner.
viol=$(npm run -s lint:check 2>&1 | grep -cE "(warning|error).*no-untenanted-query" || true)
if [ "${viol}" != "0" ]; then
  echo "FAIL: ${viol} no-untenanted-query violations remain."
  npm run -s lint:check 2>&1 | grep -E "(warning|error).*no-untenanted-query"
  exit 1
fi
echo "OK: zero R-D02 violations across the codebase."

step "2/5 — R-D01 multi-column index audit (must pass)"
npm run -s audit:tenant-indexes

step "3/5 — RuleTester self-test for no-untenanted-query (17 cases)"
npm run -s lint:rule-test

step "4/5 — Cross-tenant 4-layer rejection spec (13 tests)"
npx jest --testPathPattern="cross-tenant-isolation" --no-coverage 2>&1 \
  | grep -E "^(Tests|Test Suites|PASS|FAIL src)" | tail -5

step "5/5 — Sprint 1 supporting tests (Argon2id, lockout, ProblemDetails, DataClassification)"
npx jest --testPathPattern="(password.util|auth.service.lockout|problem-details.filter|data-classification|tenant-scope.guard)" --no-coverage 2>&1 \
  | grep -E "^(Tests|Test Suites|PASS|FAIL src)" | tail -10

echo
echo "=============================================================="
echo " Sprint 1 demo: PASS"
echo "=============================================================="
