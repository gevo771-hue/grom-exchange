import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeWsChannel } from '../src/ws/broadcaster.js';

describe('CA-03 websocket channel ACL', () => {
  const userA = { sub: '11111111-1111-1111-1111-111111111111' };
  const userB = { sub: '22222222-2222-2222-2222-222222222222' };

  it('allows public price channels anonymously', () => {
    assert.equal(authorizeWsChannel('price:BTC/USDT', null).ok, true);
    assert.equal(authorizeWsChannel('markets', null).ok, true);
  });

  it('denies user channels without JWT', () => {
    const r = authorizeWsChannel(`balances.user.${userA.sub}`, null);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'auth_required');
  });

  it('denies user A subscribing to user B', () => {
    const r = authorizeWsChannel(`notifications.user.${userB.sub}`, userA);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'channel_forbidden');
  });

  it('allows user A on own balances/notifications', () => {
    assert.equal(authorizeWsChannel(`balances.user.${userA.sub}`, userA).ok, true);
    assert.equal(authorizeWsChannel(`notifications.user.${userA.sub}`, userA).ok, true);
  });

  it('rejects unknown / oversized channels', () => {
    assert.equal(authorizeWsChannel('admin.secrets', userA).ok, false);
    assert.equal(authorizeWsChannel('x'.repeat(200), userA).ok, false);
  });
});
