/**
 * v2.0 release performance suite (plan §31.1 Sprint 24 / S24.3).
 *
 * Hits five representative endpoints across the v2.0 surface:
 *   - GET  /api/sales/pipeline             (S16.1, BI projection consumer)
 *   - GET  /api/bi/dashboards/marco/revenue_overview/data (S18.4)
 *   - GET  /api/intrastat/declarations     (S16.2)
 *   - GET  /api/treasury/accounts          (S23.1)
 *   - GET  /api/compliance/audit?limit=50  (S20.4)
 *
 * Targets are the v2.0 §20.10 budget: list endpoints P95 < 200 ms,
 * write/transactional P95 < 400 ms.
 *
 * Run: `BASE_URL=https://staging.smarterp.it JWT_TOKEN=$T k6 run tests/performance/v2-suite.js`
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

export const options = {
  vus: 50,
  duration: '4m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{group:::list}': ['p(95)<200'],
    'http_req_duration{group:::dashboard}': ['p(95)<400'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const JWT = __ENV.JWT_TOKEN || '';

const dashboardLatency = new Trend('smarterp_dashboard_ms', true);
const listLatency = new Trend('smarterp_list_ms', true);

function headers() {
  return JWT
    ? { Authorization: `Bearer ${JWT}` }
    : {};
}

const ENDPOINTS = [
  { url: '/api/sales/pipeline', group: 'list' },
  {
    url: '/api/bi/dashboards/marco%2Frevenue_overview/data',
    group: 'dashboard',
  },
  { url: '/api/intrastat/declarations', group: 'list' },
  { url: '/api/treasury/accounts', group: 'list' },
  { url: '/api/compliance/audit?limit=50', group: 'list' },
];

export default function () {
  for (const ep of ENDPOINTS) {
    const res = http.get(`${BASE_URL}${ep.url}`, {
      headers: headers(),
      tags: { group: ep.group },
    });
    check(res, {
      [`${ep.url}: 2xx`]: (r) => r.status >= 200 && r.status < 300,
    });
    if (ep.group === 'dashboard') dashboardLatency.add(res.timings.duration);
    else listLatency.add(res.timings.duration);
  }
  sleep(1);
}
