/**
 * Smoke tests that all new routers can be imported and instantiated.
 * Catches syntax / import-time errors without needing a live DB.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import createSettingsRouter from '../src/settings/routes.js';
import createSessionsRouter from '../src/sessions/routes.js';
import createReferralRouter from '../src/referral/routes.js';
import createApiKeysRouter  from '../src/apikeys/routes.js';
import createSupportRouter  from '../src/support/routes.js';
import createAdminRouter    from '../src/admin/routes.js';
import createFuturesRouter  from '../src/futures/routes.js';
import createSpotRouter     from '../src/spot/routes.js';
import createWalletRouter   from '../src/wallet/routes.js';
import createKycRouter      from '../src/kyc/routes.js';
import createOnrampRouter   from '../src/onramp/routes.js';

const fakeAuth = (req, _res, next) => { req.user = { sub: 'u1', role: 'user' }; next(); };
const fakeAggregator = { getPrice: async () => 60000 };

test('all production routers create without error', () => {
  assert.doesNotThrow(() => createSettingsRouter({ requireAuth: fakeAuth }));
  assert.doesNotThrow(() => createSessionsRouter({ requireAuth: fakeAuth }));
  assert.doesNotThrow(() => createReferralRouter({ requireAuth: fakeAuth }));
  assert.doesNotThrow(() => createApiKeysRouter({ requireAuth: fakeAuth }));
  assert.doesNotThrow(() => createSupportRouter({ requireAuth: fakeAuth }));
  assert.doesNotThrow(() => createAdminRouter({ requireAuth: fakeAuth }));
  assert.doesNotThrow(() => createFuturesRouter({ requireAuth: fakeAuth, priceAggregator: fakeAggregator }));
  assert.doesNotThrow(() => createSpotRouter({ requireAuth: fakeAuth, priceAggregator: fakeAggregator }));
  assert.doesNotThrow(() => createWalletRouter({ requireAuth: fakeAuth, priceAggregator: fakeAggregator }));
  assert.doesNotThrow(() => createKycRouter({ requireAuth: fakeAuth, client: { generateAccessToken: async () => ({ sdkToken: 't', externalUserId: 'grom-u1', levelName: 'basic' }) } }));
  assert.doesNotThrow(() => createOnrampRouter({ requireAuth: fakeAuth }));
});

test('routers export valid Express middleware', () => {
  const r = createSettingsRouter({ requireAuth: fakeAuth });
  assert.equal(typeof r, 'function');
  assert.equal(typeof r.use, 'function');
});
