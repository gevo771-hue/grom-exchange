import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'https://grom.exchange';

export const options = {
  vus: 50,
  duration: '1m',
  thresholds: { http_req_duration: ['p(95)<300'] },
};

export default function () {
  const r = http.get(`${BASE}/api/spot/orderbook?pair=BTC/USDT&depth=25`);
  check(r, { 'orderbook responded': (res) => res.status < 500 });
  sleep(0.2);
}
