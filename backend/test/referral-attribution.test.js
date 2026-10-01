import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { generateReferralCode, normalizeReferralCode, ensureReferralCode, attachReferralCode } from '../src/referral/invite.js';
import createReferralRouter from '../src/referral/routes.js';
import { pool } from '../src/db/pool.js';
import express from 'express';

const pgEnabled = process.env.GROM_REQUIRE_PG === '1';

test('referral codes use a fixed public alphabet and normalize only issued code shapes', () => {
  const code = generateReferralCode();
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
  assert.equal(normalizeReferralCode(code), code);
  assert.equal(normalizeReferralCode(`grom-${code.toLowerCase()}`), code);
  assert.equal(normalizeReferralCode('GROM-G7K3Q9'), null);
  assert.equal(normalizeReferralCode(`${code}x`), null);
});

test('referral attribution is first-signup-only, self-referrals are rejected, and summary exposes counts only', { skip: !pgEnabled }, async () => {
  const wallets = Array.from({ length: 2 }, () => `0x${randomBytes(20).toString('hex')}`);
  let server;
  try {
    const users = await Promise.all(wallets.map(async (wallet) => {
      const { rows } = await pool.query(
        `INSERT INTO users (wallet_address, chain_id) VALUES ($1,1) RETURNING id`, [wallet]
      );
      return rows[0].id;
    }));
    const [inviterId, inviteeId] = users;
    const codes = await Promise.all(Array.from({ length: 5 }, () => ensureReferralCode(inviterId)));
    const code = codes[0];
    assert.equal(new Set(codes).size, 1, 'parallel logins must converge on one code');
    assert.equal(await attachReferralCode(inviterId, code), false, 'self-referral must be rejected');
    assert.equal(await attachReferralCode(inviteeId, 'NOT-A-CODE'), false, 'unissued codes must be rejected');
    assert.equal(await attachReferralCode(inviteeId, `GROM-${code}`), true);
    assert.equal(await attachReferralCode(inviteeId, code), false, 'existing attribution must not be overwritten');

    const app = express();
    app.use('/api', createReferralRouter({
      requireAuth(req, res, next) {
        if (req.get('authorization') !== 'Bearer test') return res.status(401).json({ error: 'unauthorized' });
        req.user = { sub: inviterId };
        next();
      },
    }));
    server = await new Promise((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const denied = await fetch(`${base}/api/referral/summary`);
    assert.equal(denied.status, 401);
    const response = await fetch(`${base}/api/referral/summary`, { headers: { Authorization: 'Bearer test' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.code, `GROM-${code}`);
    assert.equal(body.link, `/r/${code}`);
    assert.equal(body.totals.total_referred, 1);
    assert.equal(body.funnel.signups_30d, 1);
    assert.equal(body.funnel.active_30d, 1);
    assert.equal(body.tracking, 'active');
    assert.equal(body.rewards, 'inactive');
    assert.equal('payout' in body, false);
    assert.equal('wallets' in body, false);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.query('DELETE FROM users WHERE wallet_address = ANY($1::text[])', [wallets]);
  }
});
