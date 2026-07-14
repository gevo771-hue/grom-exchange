import http from 'k6/http';
import { check, sleep } from 'k6';
import { baseUrl, progressiveStages, thresholds } from './_helpers.js';

/**
 * Scenario A — Landing + public static
 * Target (stress): ~500 concurrent, p95 < 200ms
 */
export const options = {
  stages: progressiveStages('public'),
  thresholds: thresholds(200, 0.01),
};

export default function () {
  const BASE = baseUrl();
  const pages = [
    `${BASE}/`,
    `${BASE}/#markets`,
    `${BASE}/#predict`,
    `${BASE}/grom-wallet.js?v=load`,
    `${BASE}/health`,
  ];
  // /health may be proxied; if 404 on static nginx, still fine for landing.
  for (const url of pages) {
    const r = http.get(url, { tags: { name: url.split('/').pop() || 'root' } });
    check(r, { 'status < 500': (res) => res.status < 500 });
    sleep(0.3 + Math.random() * 0.4);
  }
}
