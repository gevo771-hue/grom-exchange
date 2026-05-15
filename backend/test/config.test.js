import test from 'node:test';
import assert from 'node:assert/strict';

import { validateConfig } from '../src/config/index.js';

test('validateConfig rejects insecure production config', () => {
  assert.throws(
    () => validateConfig({
      env: 'production',
      auth: { jwtSecret: 'insecure-dev-secret-change-me', jwtTtl: 86400 },
      wallet: { walletConnectProjectId: '', siweDomain: 'localhost:5273' },
      allowDevLogin: true,
      db: { password: '' },
      cors: { origin: '*' },
    }),
    /Invalid configuration/
  );
});

test('validateConfig accepts hardened production config', () => {
  assert.equal(
    validateConfig({
      env: 'production',
      auth: { jwtSecret: 'super-long-production-secret', jwtTtl: 3600 },
      wallet: { walletConnectProjectId: 'proj_123', siweDomain: 'grom.exchange' },
      allowDevLogin: false,
      db: { password: 'postgres-secret' },
      cors: { origin: 'https://grom.exchange' },
    }),
    true
  );
});
