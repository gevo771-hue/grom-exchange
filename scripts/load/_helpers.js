/**
 * Shared helpers for GROM load tests.
 * STAGE: smoke | load | stress | soak | spike
 * BASE_URL: default https://grom.exchange
 *
 * Thresholds gate on TTFB (`http_req_waiting` p95), not full duration —
 * GH runners are far from origin, so load-stage budgets are looser than
 * local/smoke-on-origin numbers. Updated 2026-07-20 after repeated
 * night1 false-fails (p95 200ms vs real GH→prod ~400–900ms).
 */
export function baseUrl() {
  return (__ENV.BASE_URL || 'https://grom.exchange').replace(/\/$/, '');
}

export function stage() {
  return (__ENV.STAGE || 'smoke').toLowerCase();
}

/** Progressive stages — keep smoke tiny vs prod. */
export function progressiveStages(profile = 'public') {
  const s = stage();
  if (s === 'smoke') {
    return [
      { duration: '15s', target: 5 },
      { duration: '15s', target: 0 },
    ];
  }
  if (s === 'load') {
    return [
      { duration: '1m', target: 50 },
      { duration: '5m', target: 50 },
      { duration: '30s', target: 0 },
    ];
  }
  if (s === 'soak') {
    return [
      { duration: '2m', target: 100 },
      { duration: '2h', target: 100 },
      { duration: '1m', target: 0 },
    ];
  }
  if (s === 'spike') {
    return [
      { duration: '30s', target: 50 },
      { duration: '5s', target: 1000 },
      { duration: '2m', target: 1000 },
      { duration: '30s', target: 0 },
    ];
  }
  // stress
  if (profile === 'public') {
    return [
      { duration: '1m', target: 100 },
      { duration: '5m', target: 500 },
      { duration: '5m', target: 1000 },
      { duration: '2m', target: 0 },
    ];
  }
  return [
    { duration: '1m', target: 50 },
    { duration: '5m', target: 200 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 0 },
  ];
}

/**
 * @param {number} p95Ms ideal origin SLO for this scenario
 * @param {number} failRate max http_req_failed rate
 */
export function thresholds(p95Ms, failRate = 0.01) {
  const s = stage();
  let gate = p95Ms;
  let err = failRate;
  if (s === 'smoke') {
    gate = Math.max(p95Ms, 800);
    err = Math.max(failRate, 0.05);
  } else if (s === 'load') {
    // Unattended night1 from GitHub-hosted runners → prod
    gate = Math.max(p95Ms * 3, 900);
    err = Math.max(failRate, 0.02);
  } else if (s === 'stress' || s === 'spike') {
    gate = Math.max(p95Ms, 1500);
  } else if (s === 'soak') {
    gate = Math.max(p95Ms, 1000);
  }
  return {
    http_req_waiting: [`p(95)<${gate}`],
    http_req_failed: [`rate<${err}`],
  };
}

export function authHeaders() {
  const jwt = __ENV.GROM_JWT || '';
  if (!jwt) return { 'Content-Type': 'application/json' };
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${jwt}`,
  };
}
