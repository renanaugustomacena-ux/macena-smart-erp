import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// Write-endpoint target: P95 < 400ms (aggregate/transactional bucket).
export const options = {
  vus: 30,
  duration: '3m',
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<400'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const JWT = __ENV.JWT_TOKEN || '';
const PRODUCT_ID = __ENV.PRODUCT_ID || '00000000-0000-0000-0000-000000000000';
const WAREHOUSE_ID =
  __ENV.WAREHOUSE_ID || '00000000-0000-0000-0000-000000000001';

const writeLatency = new Trend('smarterp_inventory_write_ms', true);

export default function () {
  const body = JSON.stringify({
    productId: PRODUCT_ID,
    movementType: 'inbound',
    quantity: 5,
    destinationWarehouseId: WAREHOUSE_ID,
    referenceNumber: `k6-${__VU}-${__ITER}`,
    notes: 'k6 load test',
  });
  const res = http.post(`${BASE_URL}/api/v1/inventory/movements`, body, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JWT}`,
      'X-Request-ID': `k6-${__VU}-${__ITER}`,
    },
  });
  writeLatency.add(res.timings.duration);
  check(res, {
    'ack or auth': (r) => [200, 201, 401, 403, 404].includes(r.status),
  });
  sleep(0.5);
}
