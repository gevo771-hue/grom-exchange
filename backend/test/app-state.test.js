import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppState } from '../src/db/app-state.js';

test('app_state: upsert by key, JSON in and out', async () => {
  const calls = [];
  const rows = new Map();
  const dbQuery = async (text, params) => {
    calls.push(text.trim().split(/\s+/)[0]);
    if (/^SELECT/i.test(text.trim())) return { rows: rows.has(params[0]) ? [{ value: JSON.parse(rows.get(params[0])) }] : [] };
    assert.match(text, /ON CONFLICT \(key\) DO UPDATE/);
    rows.set(params[0], params[1]);
    return { rows: [] };
  };
  const kv = createAppState({ dbQuery });
  assert.equal(await kv.get('x'), null);
  assert.equal(await kv.set('x', { a: [1, 2] }), true);
  assert.deepEqual(await kv.get('x'), { a: [1, 2] });
  assert.deepEqual(calls, ['SELECT', 'INSERT', 'SELECT']);
});

test('app_state: a missing table or a database error is «nothing saved», never a crash', async () => {
  const kv = createAppState({ dbQuery: async () => { throw new Error('relation "app_state" does not exist'); } });
  assert.equal(await kv.get('x'), null);
  assert.equal(await kv.set('x', 1), false);
});
