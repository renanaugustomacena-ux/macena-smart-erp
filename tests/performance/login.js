import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ─── Thresholds align with v2.0 §20.10 performance targets:
//     P95 < 200ms list, < 400ms aggregate; >=500 RPS; error-rate <1%.
export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400', 'p(99)<800'],
    checks: ['rate>0.99'],
  },
  scenarios: {
    // 1x baseline: steady 50 VUs for 2 minutes.
    baseline: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      exec: 'loginFlow',
    },
    // 5x spike: ramp to 250 VUs over 30s, hold 30s, then drain.
    spike: {
      executor: 'ramping-vus',
      startTime: '2m30s',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 250 },
        { duration: '30s', target: 250 },
        { duration: '30s', target: 0 },
      ],
      exec: 'loginFlow',
      gracefulRampDown: '30s',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const loginDuration = new Trend('smarterp_login_duration_ms', true);
const loginErrorRate = new Rate('smarterp_login_errors');

export function loginFlow() {
  const payload = JSON.stringify({
    email: __ENV.TEST_EMAIL || 'demo@fonderiamozzecane.it',
    password: __ENV.TEST_PASSWORD || 'FonderiaMozzecane2026!',
  });
  const headers = { 'Content-Type': 'application/json' };

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, { headers });
  loginDuration.add(res.timings.duration);

  const ok = check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401,
    'no 5xx': (r) => r.status < 500,
    'p95 body < 10KB': (r) => r.body.length < 10_240,
  });
  loginErrorRate.add(!ok);
  sleep(1);
}
