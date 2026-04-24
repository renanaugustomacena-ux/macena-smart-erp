# SmartERP k6 performance suite

Closes GAPS entry **F-06 / H-10**: performance validation at 1x / 5x / 10x
load with P95/P99 assertions per v2.0 §20.10.

## Scripts

| Script | Purpose | Target |
|---|---|---|
| `login.js` | Baseline + 5x spike on `/api/auth/login` | P95 < 400ms, err < 1% |
| `list-products.js` | Sustained read load on product listing | P95 < 200ms, err < 1% |
| `inventory-movement.js` | Write load on stock movement POST | P95 < 400ms, err < 2% |

## Run locally

```bash
export BASE_URL=http://localhost:3001
export JWT_TOKEN=$(curl -s -X POST $BASE_URL/api/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"demo@fonderiamozzecane.it","password":"FonderiaMozzecane2026!"}' | jq -r .accessToken)

k6 run tests/performance/login.js
k6 run tests/performance/list-products.js
k6 run tests/performance/inventory-movement.js
```

## CI

A `k6-perf` job is wired in `.github/workflows/ci.yml` (see `perf` stage).
It spins up docker-compose, seeds the demo tenant, then runs `login.js`
against the backend service with strict thresholds. Failures fail the
pipeline; results upload as HTML artefact to `raw-scans/SmartERP/k6-*`.
