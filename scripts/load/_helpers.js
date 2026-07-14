/**
 * Shared helpers for GROM load tests.
 * STAGE: smoke | load | stress | soak | spike
 * BASE_URL: default https://grom.exchange
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

export function thresholds(p95Ms, failRate = 0.01) {
  // Smoke thresholds are looser so flaky cold-starts don't false-fail CI.
  const smoke = stage() === 'smoke';
  return {
    http_req_duration: [`p(95)<${smoke ? Math.max(p95Ms, 500) : p95Ms}`],
    http_req_failed: [`rate<${smoke ? 0.05 : failRate}`],
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
