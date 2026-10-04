import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../frontend/public/grom-wallet.js', import.meta.url), 'utf8');
function fn(name) {
  const at = source.indexOf(`function ${name}(`);
  assert.ok(at >= 0);
  const end = source.indexOf('\n}', at) + 2;
  return (source.slice(at - 6, at) === 'async ' ? 'async ' : '') + source.slice(at, end);
}
function storageFixture(values = new Map()) {
  return {
    values,
    get length() { return values.size; },
    key: (i) => [...values.keys()][i],
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
}
function factory(localStorage) {
  const ctx = vm.createContext({ localStorage });
  vm.runInContext(fn('gwMakePersistentWcStorage'), ctx);
  return ctx.gwMakePersistentWcStorage();
}

test('a page reload restores the actual SDK session and its encryption key', async () => {
  // Disable SDK's global Core reuse: two instances must be independent, like separate page lifetimes.
  process.env.DISABLE_GLOBAL_CORE = 'true';
  const bundle = readFileSync(new URL('../../frontend/public/wc/sign-client.bundle.js', import.meta.url), 'utf8');
  const { default: SignClient } = await import('data:text/javascript;base64,' + Buffer.from(bundle).toString('base64'));
  const local = storageFixture();
  const options = { projectId: '28302d1699a8833692b54f0454164625', logger: 'silent' };
  const first = new SignClient({ ...options, storage: factory(local) });
  await first.core.crypto.init();
  await first.session.init();
  const topic = 'grom-test-session';
  await first.core.crypto.setSymKey('ab'.repeat(32), topic);
  first.session.set(topic, { topic, expiry: Math.floor(Date.now() / 1000) + 300,
    namespaces: { eip155: { accounts: ['eip155:42161:0x1111111111111111111111111111111111111111'] } } });
  await first.session.persist();
  const payload = { id: 1, jsonrpc: '2.0', method: 'test', params: [] };
  const encrypted = await first.core.crypto.encode(topic, payload);

  const reloaded = new SignClient({ ...options, storage: factory(local) });
  assert.notEqual(reloaded.core, first.core);
  await reloaded.core.crypto.init();
  await reloaded.session.init();
  assert.equal(reloaded.session.getAll()[0].topic, topic);
  assert.deepEqual(await reloaded.core.crypto.decode(topic, encrypted), payload);
  // No network or signing request is sent in this test.
});

test('storage reads current values across tabs, removes keys and keeps unrelated auth', async () => {
  const local = storageFixture(new Map([['grom_wallet_label', 'saved-address']]));
  const tab1 = factory(local);
  const tab2 = factory(local);
  await tab1.setItem('wc@2:core:0.3//keychain', { value: 'fake-key' });
  assert.deepEqual(JSON.parse(JSON.stringify(await tab2.getItem('wc@2:core:0.3//keychain'))), { value: 'fake-key' });
  assert.equal((await tab2.getEntries()).length, 1);
  await tab2.removeItem('wc@2:core:0.3//keychain');
  assert.equal(await tab1.getItem('wc@2:core:0.3//keychain'), undefined);
  assert.equal(local.getItem('grom_wallet_label'), 'saved-address');
});

test('denied/full storage fails instead of silently creating a nonpersistent session', async () => {
  const local = storageFixture();
  local.setItem = () => { throw new Error('QuotaExceededError'); };
  await assert.rejects(factory(local).setItem('session', { topic: 'fake' }), /QuotaExceededError/);
});

function clientContext(init) {
  const local = storageFixture();
  const ctx = vm.createContext({ localStorage: local, window: {}, console: { log() {} },
    setTimeout, clearTimeout,
    _wcClient: null, _wcClientPromise: null, _wcClientPromiseAt: 0, _wcCore: null,
    WC_PROJECT_ID: '28302d1699a8833692b54f0454164625',
    gwEnsureFeeConfig: async () => {}, gwEnsureOnlineForWc: async () => {},
    gwWarmVerifyIframe() {}, walletMetadata: () => ({}), gwPatchWcVerify() {},
    gwLoadSignClient: async () => ({ default: { init } }),
  });
  vm.runInContext([fn('gwMakePersistentWcStorage'), fn('gwWcWaitForClient'), fn('gwWcClient')].join('\n'), ctx);
  return ctx;
}

test('slow initialization stays single-flight even after the old 3.5 second threshold', async () => {
  let resolve;
  let calls = 0;
  const client = { core: {} };
  const ctx = clientContext(() => { calls++; return new Promise((r) => { resolve = r; }); });
  const first = ctx.gwWcClient();
  await new Promise((r) => setImmediate(r));
  ctx._wcClientPromiseAt = Date.now() - 10000;
  const second = ctx.gwWcClient();
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1);
  resolve(client);
  assert.equal(await first, client);
  assert.equal(await second, client);
});

test('failed SDK initialization preserves saved session data for retry', async () => {
  let calls = 0;
  const ctx = clientContext(async () => { if (++calls === 1) throw new Error('relay offline'); return { core: {} }; });
  await ctx.gwMakePersistentWcStorage().setItem('session', { topic: 'saved' });
  await assert.rejects(ctx.gwWcClient(), /relay offline/);
  assert.equal((await ctx.gwMakePersistentWcStorage().getItem('session')).topic, 'saved');
  await ctx.gwWcClient();
  assert.equal(calls, 2);
});

test('silent swap restore failure does not fall through to a new connection prompt', async () => {
  let connections = 0;
  const ctx = vm.createContext({ window: {}, console: { log() {} },
    gwActiveSigningProvider: () => null,
    gwHasPersistedWcSession: () => true,
    gwRestorePersistedWcSession: async () => { throw new Error('relay offline'); },
    connectWalletWC: async () => { connections++; },
    gwToast() {}, _wcClient: null, _wcClientPromise: null,
  });
  vm.runInContext(fn('gwEnsureSigningForSwap'), ctx);
  await assert.rejects(ctx.gwEnsureSigningForSwap({ silent: true }), /relay offline/);
  assert.equal(connections, 0);
});

test('reload restores the matching wallet topic and swap uses it without a new pairing', async () => {
  const address = '0x1111111111111111111111111111111111111111';
  const now = Math.floor(Date.now() / 1000);
  const session = (topic, account, expiry) => ({ topic, expiry,
    namespaces: { eip155: { accounts: ['eip155:42161:' + account] } } });
  const matching = session('existing-topic', address, now + 300);
  const requests = [];
  const handlers = new Map();
  const client = {
    session: { getAll: () => [session('expired', address, now - 1),
      session('other-wallet', '0x2222222222222222222222222222222222222222', now + 900), matching] },
    request: async (request) => { requests.push(request); return 'fake-hash'; },
    on(event, handler) { handlers.set(event, handler); },
  };
  const ctx = vm.createContext({ window: { GROM_CONN: {} }, currentAccount: null, currentChainId: 1,
    wcProvider: null, _wcClient: null, _wcClientPromise: null,
    localStorage: storageFixture(new Map([['grom_wallet_label', address]])),
    document: { dispatchEvent() {} }, CustomEvent: function () {}, console: { log() {} },
    gwWcClient: async () => client, gwHasPersistedWcSession: () => true,
    gwAddrOk: (a) => /^0x[a-fA-F0-9]{40}$/.test(a),
    gwWcSessionAddress: (s) => s?.namespaces.eip155.accounts[0].split(':')[2] || '',
    chainIdFromWcSession: () => 42161, wcChainRefForRequest: () => 'eip155:42161',
    gwPatchProviderRequestAccounts: (p) => p,
  });
  vm.runInContext([fn('gwSignClientRequest'), fn('buildSignClientEip1193'), fn('gwRestoreSignClientSession'),
    fn('gwRestorePersistedWcSession'), fn('gwEnsureSigningForSwap'),
    'function gwActiveSigningProvider(){ return wcProvider; }'].join('\n'), ctx);
  const restored = await ctx.gwRestorePersistedWcSession();
  assert.equal(restored.session.topic, matching.topic);
  assert.equal(ctx.window.GROM_CONN.label, address);
  const signer = await ctx.gwEnsureSigningForSwap({ silent: true });
  assert.equal(signer, restored);
  await signer.request({ method: 'eth_sendTransaction', params: [{ from: address, value: '0x0' }] });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].topic, 'existing-topic');
  assert.equal(requests[0].request.method, 'eth_sendTransaction');
  handlers.get('session_delete')({ topic: 'another-tab' });
  assert.equal(ctx.wcProvider, restored, 'deletion of a sibling must not disconnect this provider');
  const replacement = { session: { topic: 'new-connection' } };
  ctx.wcProvider = replacement;
  handlers.get('session_delete')({ topic: matching.topic });
  assert.equal(ctx.wcProvider, replacement, 'a late event for the previous provider must not clear its replacement');
});

test('an expired session is not presented as a live signer', async () => {
  const ctx = vm.createContext({ window: {}, currentAccount: null, wcProvider: null,
    _wcClient: null, _wcClientPromise: null, console: { log() {} },
    localStorage: storageFixture(), gwHasPersistedWcSession: () => true,
    gwWcClient: async () => ({ session: { getAll: () => [{ expiry: 1 }] } }),
    gwAddrOk: () => false,
  });
  vm.runInContext(fn('gwRestoreSignClientSession'), ctx);
  assert.equal(await ctx.gwRestoreSignClientSession(), null);
  assert.equal(ctx.wcProvider, null);
});
