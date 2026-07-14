import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'https://grom.exchange';

export const options = {
  vus: 30,
  duration: '1m',
  thresholds: { http_req_duration: ['p(95)<2000'] },
};

export default function () {
  const url = `${BASE}/api/swap/convert/quote`;
  const r = http.post(url, JSON.stringify({ from: 'USDT', to: 'USDC', fromAmount: 10 }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(r, { 'quote responded': (res) => res.status < 500 });
  sleep(0.5);
}
