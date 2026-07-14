import http from 'k6/http';
import { check, sleep } from 'k6';
import { baseUrl, progressiveStages, thresholds, authHeaders } from './_helpers.js';

/**
 * Scenario C — Swap quote storm
 * Target (stress): 200 vus, p95 < 1.5s (external aggregator latency dominates)
 */
export const options = {
  stages: progressiveStages('api'),
  thresholds: thresholds(1500, 0.2),
};

export default function () {
  const BASE = baseUrl();
  // Prefer public/unauth paths when available; auth quote as secondary.
  const paths = [
    { url: `${BASE}/api/swap/convert/quote`, body: { from: 'USDT', to: 'USDC', fromAmount: 10 } },
    { url: `${BASE}/api/swap/quote`, body: { chainId: 42161, src: 'USDT', dst: 'USDC', amount: '1000000' } },
  ];
  const pick = paths[Math.floor(Math.random() * paths.length)];
  const r = http.post(pick.url, JSON.stringify(pick.body), {
    headers: authHeaders(),
    tags: { name: 'swap_quote' },
  });
  check(r, { 'quote responded <500': (res) => res.status < 500 });
  sleep(0.4 + Math.random() * 0.6);
}
