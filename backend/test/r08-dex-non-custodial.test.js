/**
 * R08 — custodial / CEX path is physically removed.
 * Legacy financial endpoints must 404 (no route), not return 410 stubs.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import createWalletRouter from '../src/wallet/routes.js';
import createAdminRouter from '../src/admin/routes.js';

function fakeAuth(req, _res, next) {
  req.user = { sub: '00000000-0000-4000-8000-000000000001', addr: '0x' + 'ab'.repeat(20), role: 'admin' };
  next();
}

async function withApp(mount, pathPrefix = '') {
  const app = express();
  app.use(express.json());
  app.use(pathPrefix, mount);
  return app;
}

function request(app, method, url, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const { port } = server.address();
      try {
        const r = await fetch(`http://127.0.0.1:${port}${url}`, {
          method,
          headers: body ? { 'content-type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const text = await r.text();
        let json = null;
        try { json = JSON.parse(text); } catch { /* */ }
        resolve({ status: r.status, json, text });
      } catch (e) {
        reject(e);
      } finally {
        server.close();
      }
    });
  });
}

describe('R08 custodial routes removed (404)', () => {
  it('wallet custodial endpoints return 404', async () => {
    const wallet = createWalletRouter({
      requireAuth: fakeAuth,
      priceAggregator: { getPrice: async () => 1 },
    });
    const app = await withApp(wallet, '/api');
    const paths = [
      ['GET', '/api/wallet/deposit-address'],
      ['GET', '/api/wallet/whitelist'],
      ['POST', '/api/wallet/whitelist'],
      ['POST', '/api/wallet/withdrawals'],
      ['POST', '/api/wallet/withdrawals/00000000-0000-4000-8000-000000000099/confirm-signature'],
      ['POST', '/api/wallet/withdrawals/00000000-0000-4000-8000-000000000099/confirm-otp'],
      ['POST', '/api/webhooks/wallet-settlement'],
      ['POST', '/api/webhooks/moonpay'],
      ['POST', '/api/webhooks/transak'],
    ];
    for (const [method, url] of paths) {
      const r = await request(app, method, url, method === 'GET' ? null : {});
      assert.equal(r.status, 404, `${method} ${url} → ${r.status} ${r.text}`);
      assert.notEqual(r.json?.error, 'dex_non_custodial');
    }
  });

  it('admin custodial endpoints return 404', async () => {
    const admin = createAdminRouter({ requireAuth: fakeAuth });
    const app = await withApp(admin, '/api/admin');
    const paths = [
      ['GET', '/api/admin/kyc/queue'],
      ['POST', '/api/admin/kyc/u1'],
      ['GET', '/api/admin/withdrawals'],
      ['POST', '/api/admin/withdrawals/t1/approve'],
      ['POST', '/api/admin/withdrawals/t1/reject'],
      ['GET', '/api/admin/wallet/reserves'],
      ['POST', '/api/admin/wallet/sweep-now'],
      ['POST', '/api/admin/wallet/test-broadcast'],
      ['GET', '/api/admin/binance/status'],
      ['POST', '/api/admin/binance/test-call'],
      ['GET', '/api/admin/email-templates'],
      ['GET', '/api/admin/treasury/summary'],
      ['POST', '/api/admin/users/u1/balance-adjust'],
      ['POST', '/api/admin/users/u1/limits'],
    ];
    for (const [method, url] of paths) {
      const r = await request(app, method, url, method === 'GET' ? null : { amount: 1, asset: 'USDT' });
      assert.equal(r.status, 404, `${method} ${url} → ${r.status} ${r.text}`);
      assert.notEqual(r.json?.error, 'dex_non_custodial');
    }
  });
});
