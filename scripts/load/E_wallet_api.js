import http from 'k6/http';
import { check, sleep } from 'k6';
import { baseUrl, progressiveStages, thresholds, authHeaders } from './_helpers.js';

/**
 * Scenario E — Auth'd wallet API (RPC-heavy)
 * Target: 100 vus, p95 < 800ms
 * Requires: GROM_JWT env (Bearer from a real SIWE session)
 */
export const options = {
  stages: progressiveStages('api'),
  thresholds: thresholds(800, 0.15),
};

export default function () {
  const BASE = baseUrl();
  if (!__ENV.GROM_JWT) {
    // Still hit health so script is runnable without secrets in smoke.
    const h = http.get(`${BASE}/health`);
    check(h, { 'health ok without jwt': (r) => r.status === 200 || r.status === 404 });
    sleep(1);
    return;
  }
  const endpoints = [
    `${BASE}/api/wallet/overview`,
    `${BASE}/api/referral/summary`,
    `${BASE}/api/settings`,
  ];
  for (const url of endpoints) {
    const r = http.get(url, { headers: authHeaders(), tags: { name: url.split('/').slice(-2).join('/') } });
    check(r, { 'auth api <500': (res) => res.status < 500 });
    sleep(0.2);
  }
  sleep(0.5);
}
