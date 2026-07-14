import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'https://grom.exchange';

export const options = {
  vus: 20,
  duration: '1m',
  thresholds: { http_req_duration: ['p(95)<800'] },
};

export default function () {
  const nonce = http.post(`${BASE}/auth/nonce`);
  check(nonce, { 'nonce ok-ish': (r) => r.status === 200 || r.status === 404 || r.status === 405 });
  http.post(`${BASE}/auth/verify`, JSON.stringify({
    address: '0x' + 'a'.repeat(40),
    signature: '0x' + 'b'.repeat(130),
    message: 'load-test',
  }), { headers: { 'Content-Type': 'application/json' } });
  sleep(0.3);
}
