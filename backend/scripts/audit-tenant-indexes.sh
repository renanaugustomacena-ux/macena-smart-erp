#!/usr/bin/env bash
# Sprint 1 — Story S1.2 (R-D01 enforcement).
# Audits every multi-column index in the schema (entity decorators + migration
# CREATE INDEX statements) and asserts `tenantId` is the first column. Exits
# non-zero on any unjustified deviation.
#
# Documented exemptions (see docs/audits/M-001-tenantid-index-audit.md):
#   - users.email (globally unique by design; ADR-007).
#   - tenants.vatNumber (Tenant aggregate itself; tenantId IS the PK; ADR-001).
#   - audit_logs.correlationId (cross-tenant correlation lookup by design).
#
# Run from repo root or backend/.

set -u
set -o pipefail

if [ -d "backend" ]; then
  cd backend
fi

src_dirs=(src)
fail=0

# 1. @Index([...]) decorators with 2+ columns
echo "Scanning @Index decorators..."
violations=$(grep -rnE "@Index\(\[" "${src_dirs[@]}" \
  | grep -vE "@Index\(\['tenantId'" \
  | grep -E "@Index\(\['[^']+',\s*'[^']+'" \
  || true)

if [ -n "$violations" ]; then
  echo "VIOLATION (R-D01): @Index decorators with non-tenantId first column:"
  echo "$violations"
  echo
  fail=1
fi

# 2. CREATE INDEX in migrations with 2+ columns
echo "Scanning migration CREATE INDEX statements..."
mig_violations=$(grep -rnE 'CREATE (UNIQUE )?INDEX[^(]*ON [^(]+\("[^"]+","[^"]+' "${src_dirs[@]}/migrations" 2>/dev/null \
  | grep -vE '\("tenantId"' \
  || true)

if [ -n "$mig_violations" ]; then
  echo "VIOLATION (R-D01): migration CREATE INDEX with non-tenantId first column:"
  echo "$mig_violations"
  echo
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "audit-tenant-indexes: all multi-column indexes start with tenantId (R-D01 OK)."
  exit 0
else
  echo "audit-tenant-indexes: violations found. Either reorder the index, or document the exemption in docs/audits/M-001-tenantid-index-audit.md and re-run."
  exit 1
fi
