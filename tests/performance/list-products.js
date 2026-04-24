import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// List-endpoint target: P95 < 200ms per v2.0 §20.10.
export const options = {
  vus: 100,
  duration: '3m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200', 'p(99)<400'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const JWT = __ENV.JWT_TOKEN || '';
const productList = new Trend('smarterp_products_list_ms', true);

export default function () {
  const res = http.get(
    `${BASE_URL}/api/v1/inventory/products?limit=50&offset=0`,
    {
      headers: {
        Authorization: `Bearer ${JWT}`,
        'X-Request-ID': `k6-${__VU}-${__ITER}`,
      },
    },
  );
  productList.add(res.timings.duration);

  check(res, {
    'status OK or 401': (r) => [200, 401, 403].includes(r.status),
    'content-type json': (r) =>
      (r.headers['Content-Type'] || '').includes('application/json'),
  });
  sleep(0.2);
}
