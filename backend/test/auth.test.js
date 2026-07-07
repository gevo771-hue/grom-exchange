import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

import { requireAuth } from '../src/wallet/siwe.js';
import config from '../src/config/index.js';

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function dbAvailable() {
  try {
    const { query } = await import('../src/db/pool.js');
    await query('SELECT 1');
    return query;
  } catch {
    return null;
  }
}

test('requireAuth rejects missing bearer token', async () => {
  const req = { headers: {} };
  const res = mockRes();
  let nextCalled = false;
  await requireAuth(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'missing token' });
});

test('requireAuth accepts valid bearer token and attaches user', async (t) => {
  const query = await dbAvailable();
  if (!query) return t.skip('postgres unavailable');

  const userId = randomUUID();
  const wallet = '0x' + randomUUID().replace(/-/g, '').slice(0, 40);
  await query(
    `INSERT INTO users (id, wallet_address, chain_id, status, risk_level)
     VALUES ($1, $2, 1, 'active', 'standard')`,
    [userId, wallet]
  );
  const token = jwt.sign(
    { sub: userId, addr: wallet, chain: 1 },
    config.auth.jwtSecret,
    { expiresIn: 60 }
  );
  const req = { headers: { authorization: 'Bearer ' + token } };
  const res = mockRes();
  let nextCalled = false;
  try {
    await requireAuth(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.user.sub, userId);
  } finally {
    await query('DELETE FROM users WHERE id=$1', [userId]);
  }
});

test('requireAuth rejects suspended users', async (t) => {
  const query = await dbAvailable();
  if (!query) return t.skip('postgres unavailable');

  const userId = randomUUID();
  const wallet = '0x' + randomUUID().replace(/-/g, '').slice(0, 40);
  await query(
    `INSERT INTO users (id, wallet_address, chain_id, status, risk_level)
     VALUES ($1, $2, 1, 'suspended', 'standard')`,
    [userId, wallet]
  );
  const token = jwt.sign(
    { sub: userId, addr: wallet, chain: 1 },
    config.auth.jwtSecret,
    { expiresIn: 60 }
  );
  const req = { headers: { authorization: 'Bearer ' + token } };
  const res = mockRes();
  let nextCalled = false;
  try {
    await requireAuth(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.body, { error: 'account_suspended' });
  } finally {
    await query('DELETE FROM users WHERE id=$1', [userId]);
  }
});
