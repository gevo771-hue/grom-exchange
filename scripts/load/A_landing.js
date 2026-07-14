import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'https://grom.exchange';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.02'],
  },
};

export default function () {
  const r1 = http.get(`${BASE}/`);
  check(r1, { 'landing 200': (r) => r.status === 200 });
  sleep(0.5);
  const r2 = http.get(`${BASE}/#markets`);
  check(r2, { 'markets page 200': (r) => r.status === 200 });
  sleep(0.5);
  const r3 = http.get(`${BASE}/grom-wallet.js?v=probe`);
  check(r3, { 'wallet js 200': (r) => r.status === 200 });
  sleep(1);
}
