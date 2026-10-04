import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';

const source = readFileSync(new URL('../../frontend/public/grom-wallet.js', import.meta.url), 'utf8');
function fn(name) {
  const at = source.indexOf(`function ${name}(`);
  assert.ok(at >= 0);
  return (source.slice(at - 6, at) === 'async ' ? 'async ' : '') + source.slice(at, source.indexOf('\n}', at) + 2);
}
function harness() {
  const events = new EventEmitter();
  let resolve, reject;
  const calls = [], wake = [], timers = [];
  const client = { on: events.on.bind(events), off: events.off.bind(events),
    request: args => { calls.push(args); return new Promise((yes, no) => { resolve = yes; reject = no; }); } };
  const session = { topic: 'existing-session', namespaces: { eip155: { accounts: ['eip155:42161:0x' + '1'.repeat(40)] } } };
  const context = vm.createContext({ window: {}, console, JSON,
    op: { id: 'test', stage: 'preparing' },
    currentChainId: 42161,
    gwAddrOk: () => true, chainIdFromWcSession: () => 42161,
    wcChainRefForRequest: () => 'eip155:42161',
    gwSwapOpGet: () => context.op,
    gwMarkSwapWalletRequestDispatched: () => { context.op.stage = 'awaiting_signature'; return { ...context.op, walletRequestAt: 1 }; },
    gwMarkSwapWalletRequestSettled: (_args, result, error, dispatch) => {
      if (dispatch) Object.assign(context.op, { result, error });
    },
    gwIsRemoteWcSigner: () => true,
    gwWakeWalletForSigning: opts => wake.push(opts), gwHideRemoteSignCoach() {},
    setTimeout: cb => { timers.push(cb); return timers.length; },
    clearTimeout: id => { if (id) timers[id - 1] = () => {}; },
  });
  vm.runInContext([fn('gwSignClientRequest'), fn('buildSignClientEip1193'), fn('gwProviderRequestWithWake')].join('\n'), context);
  const provider = context.buildSignClientEip1193(client, session);
  const args = { method: 'eth_sendTransaction', params: [{ from: '0x' + '1'.repeat(40), to: '0x' + '2'.repeat(40), value: '0x0' }] };
  return { context, events, calls, wake, timers, provider, args,
    begin: () => context.gwProviderRequestWithWake(provider, args),
    sent: (patch = {}) => events.emit('session_request_sent', { topic: session.topic, chainId: 'eip155:42161', request: args, ...patch }),
    resolve: value => resolve(value), reject: err => reject(err) };
}

test('relay preparation never pretends a wallet prompt was dispatched', async () => {
  const h = harness(); const pending = h.begin();
  assert.equal(h.context.op.stage, 'preparing');
  assert.equal(h.timers.length, 0);
  h.reject(new Error('relay offline before dispatch'));
  await assert.rejects(pending, /relay offline/);
  assert.equal(h.context.op.stage, 'preparing');
  assert.equal(h.events.listenerCount('session_request_sent'), 0);
  assert.equal(h.wake.length, 0);
});

test('only the matching SDK dispatch wakes Trust and preserves the existing topic', async () => {
  const h = harness(); const pending = h.begin();
  h.sent({ topic: 'another-tab' });
  h.sent({ chainId: 'eip155:1' });
  h.sent({ request: { method: 'personal_sign', params: [] } });
  assert.equal(h.timers.length, 0);
  h.sent(); h.sent();
  assert.equal(h.context.op.stage, 'awaiting_signature');
  assert.equal(h.timers.length, 1);
  h.timers[0]();
  assert.equal(h.wake.length, 1);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].topic, 'existing-session');
  assert.deepEqual(Object.keys(h.calls[0].request).sort(), ['method', 'params']);
  h.resolve('0x' + 'a'.repeat(64));
  assert.equal(await pending, '0x' + 'a'.repeat(64));
  assert.equal(h.events.listenerCount('session_request_sent'), 0);
});

test('wallet rejection before delayed wake cancels the coach', async () => {
  const h = harness(); const pending = h.begin(); h.sent();
  h.reject(Object.assign(new Error('User rejected'), { code: 4001 }));
  await assert.rejects(pending, /User rejected/);
  h.timers.forEach(cb => cb()); h.sent();
  assert.equal(h.wake.length, 0);
  assert.equal(h.events.listenerCount('session_request_sent'), 0);
});

test('native Trust wake opens the app without website or new pairing', () => {
  const ctx = vm.createContext({ navigator: { userAgent: 'iPhone Safari' } });
  vm.runInContext(fn('gwWakeConnectedWalletDeepLink'), ctx);
  assert.equal(ctx.gwWakeConnectedWalletDeepLink('trust'), 'trust://');
  ctx.navigator.userAgent = 'Android Chrome';
  assert.match(ctx.gwWakeConnectedWalletDeepLink('trust'), /^intent:\/\/open#Intent;/);
  ctx.navigator.userAgent = 'Macintosh Chrome';
  assert.equal(ctx.gwWakeConnectedWalletDeepLink('trust'), '');
});

test('pruning a new connection preserves live sibling sessions in other tabs', () => {
  const disconnected = [];
  const now = Math.floor(Date.now() / 1000);
  const client = { session: { getAll: () => [{ topic: 'kept', expiry: now + 300 },
    { topic: 'other-tab', expiry: now + 300 }, { topic: 'expired', expiry: now - 1 }] },
    disconnect: args => { disconnected.push(args.topic); return Promise.resolve(); } };
  const ctx = vm.createContext({ console: { log() {} }, Date });
  vm.runInContext(fn('gwWcPruneStaleSessions'), ctx);
  ctx.gwWcPruneStaleSessions(client, 'kept');
  assert.deepEqual(disconnected, ['expired']);
});

test('a cached address cannot turn a deleted or expired SDK session into a signer', () => {
  const ctx = vm.createContext({ Date });
  vm.runInContext(fn('gwWcProviderUsable'), ctx);
  const valid = { topic: 'saved', expiry: Math.floor(Date.now() / 1000) + 300 };
  const provider = { request() {}, accounts: ['cached-address'], session: valid,
    signClient: { session: { get: () => valid } } };
  assert.equal(ctx.gwWcProviderUsable(provider), true);
  provider.signClient.session.get = () => { throw new Error('No matching session'); };
  assert.equal(ctx.gwWcProviderUsable(provider), false);
  provider.signClient.session.get = () => ({ ...valid, expiry: 1 });
  assert.equal(ctx.gwWcProviderUsable(provider), false);
});
