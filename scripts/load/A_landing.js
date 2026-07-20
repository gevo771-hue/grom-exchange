import http from 'k6/http';
import { check, sleep } from 'k6';
import { baseUrl, progressiveStages, thresholds } from './_helpers.js';

/**
 * Scenario A — Landing + public health
 * Large static bundles are NOT hammered here — a multi-MB JS download
 * was false-failing TTFB SLOs in night1 CI.
 */
export const options = {
  stages: progressiveStages('public'),
  thresholds: thresholds(200, 0.01),
};

export default function () {
  const BASE = baseUrl();
  const pages = [
    `${BASE}/`,
    `${BASE}/health`,
  ];
  for (const url of pages) {
    const name = url.endsWith('/') ? 'root' : url.split('/').pop();
    const r = http.get(url, { tags: { name } });
    check(r, { 'status < 500': (res) => res.status < 500 });
    sleep(0.2 + Math.random() * 0.3);
  }
}
