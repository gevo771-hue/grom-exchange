import http from 'k6/http';
import { check, sleep } from 'k6';
import { baseUrl, progressiveStages, thresholds } from './_helpers.js';

/**
 * Scenario B — SIWE / auth login burst
 * Target (stress): 100 concurrent, p95 < 500ms on nonce path
 * Note: verify intentionally fails with mock signature — still loads PG.
 */
export const options = {
  stages: progressiveStages('api'),
  thresholds: thresholds(500, 0.5), // verify expects client errors
};

export default function () {
  const BASE = baseUrl();
  const nonce = http.post(`${BASE}/auth/nonce`, null, {
    tags: { name: 'auth_nonce' },
  });
  check(nonce, {
    'nonce reachable': (r) => r.status === 200 || r.status === 404 || r.status === 405,
  });

  let nonceVal = 'loadtest';
  try {
    const j = nonce.json();
    if (j && j.nonce) nonceVal = j.nonce;
  } catch (_) {}

  const verify = http.post(
    `${BASE}/auth/verify`,
    JSON.stringify({
      address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      signature: '0x' + 'bb'.repeat(65),
      message: `${'grom.exchange'} wants you to sign in with your Ethereum account:\n0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n\nload-test\n\nURI: ${BASE}\nVersion: 1\nChain ID: 1\nNonce: ${nonceVal}\nIssued At: ${new Date().toISOString()}`,
    }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'auth_verify' } }
  );
  check(verify, { 'verify responded': (r) => r.status > 0 });
  sleep(0.2 + Math.random() * 0.3);
}
