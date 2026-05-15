import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

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

test('requireAuth rejects missing bearer token', () => {
  const req = { headers: {} };
  const res = mockRes();
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'missing token' });
});

test('requireAuth accepts valid bearer token and attaches user', () => {
  const token = jwt.sign(
    { sub: 'user-1', addr: '0xabc', chain: 1 },
    config.auth.jwtSecret,
    { expiresIn: 60 }
  );
  const req = { headers: { authorization: 'Bearer ' + token } };
  const res = mockRes();
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.user.sub, 'user-1');
});
