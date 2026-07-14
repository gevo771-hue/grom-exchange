import http from 'k6/http';
import { check, sleep } from 'k6';
import { baseUrl, progressiveStages, thresholds } from './_helpers.js';

/**
 * Scenario D — Orderbook flood (must be cached)
 * Target (stress): 500 vus, p95 < 100ms
 */
export const options = {
  stages: progressiveStages('public'),
  thresholds: thresholds(100, 0.02),
};

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];

export default function () {
  const BASE = baseUrl();
  const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
  const r = http.get(`${BASE}/api/spot/orderbook?pair=${encodeURIComponent(pair)}&depth=25`, {
    tags: { name: 'orderbook' },
  });
  check(r, { 'orderbook <500': (res) => res.status < 500 });
  sleep(0.05 + Math.random() * 0.15);
}
