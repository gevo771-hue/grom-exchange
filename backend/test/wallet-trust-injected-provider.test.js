import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const walletSrc = fs.readFileSync(path.join(here, '../../frontend/public/grom-wallet.js'), 'utf8');

function extractFunction(name) {
  const start = walletSrc.indexOf(`function ${name}(`);
  const asyncStart = walletSrc.indexOf(`async function ${name}(`);
  const at = start < 0 ? asyncStart : asyncStart >= 0 ? Math.min(start, asyncStart) : start;
  assert.notEqual(at, -1, `missing ${name}`);
  const open = walletSrc.indexOf('{', at);
  let depth = 0;
  let quote = '';
  let lineComment = false;
  let blockComment = false;
  let escaped = false;
  for (let i = open; i < walletSrc.length; i += 1) {
    const ch = walletSrc[i];
    const next = walletSrc[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') { blockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '/' && next === '/') { lineComment = true; i += 1; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return walletSrc.slice(at, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

const account = '0x6E16eDceac79A4c48b5e5a78A3123456789abcde';

test('Trust namespace EVM provider is discovered even without wallet marker flags', async () => {
  const calls = [];
  const provider = {
    request: async ({ method }) => {
      calls.push(method);
      if (method === 'eth_accounts') return [account];
      if (method === 'eth_sendTransaction') return '0x' + 'a'.repeat(64);
      throw new Error(`unexpected provider method ${method}`);
    },
  };
  const values = new Map([['grom_wallet_label', account]]);
  const context = vm.createContext({
    window: { trustwallet: { ethereum: provider }, GROM_CONN: { connected: false, label: '', method: '' }, gromWallet: null },
    EIP6963: new Map(),
    currentAccount: null,
    wcProvider: null,
    localStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    document: { dispatchEvent() {} },
    CustomEvent: function CustomEvent() {},
    updateChip() {},
    gwFanOutSideChains() {},
    gwPatchProviderRequestAccounts: (p) => p,
    gwWcSessionAddress: () => '',
    gwMarkSwapWalletRequestDispatched: () => null,
    gwMarkSwapWalletRequestSettled() {},
    gwClearIosWcDeepLinkIfNeeded() {},
    gwIsRemoteWcSigner: () => false,
    setTimeout() {}, clearTimeout() {},
    console: { log() {} },
  });
  vm.runInContext([
    'function rdnsProvider(){ return null; }',
    'function gwAddrOk(a){ return typeof a === "string" && /^0x[a-fA-F0-9]{40}$/.test(a.trim()); }',
    extractFunction('legacyProviders'),
    extractFunction('findLegacy'),
    extractFunction('isMetaMaskProvider'),
    extractFunction('isTrustProvider'),
    extractFunction('resolveTrustProvider'),
    extractFunction('gwHasInjectedEthAddress'),
    extractFunction('gwAllInjectedProviders'),
    extractFunction('gwPickBestInjectedProvider'),
    extractFunction('gwActiveSigningProvider'),
    extractFunction('gwWcProviderUsable'),
    extractFunction('gwRestoreInjectedEthereum'),
    extractFunction('gwEnsureSigningForSwap'),
    extractFunction('gwProviderRequestWithWake'),
  ].join('\n'), context);

  assert.equal(context.resolveTrustProvider(), provider);
  assert.ok(context.gwAllInjectedProviders().includes(provider));
  assert.equal(await context.gwRestoreInjectedEthereum(), account);
  assert.equal(context.window.__gwLiveInjectedProvider, provider);
  assert.equal(context.window.GROM_CONN.label, account);
  assert.equal(await context.gwEnsureSigningForSwap({ silent: true }), provider);
  assert.equal(await context.gwProviderRequestWithWake(provider, {
    method: 'eth_sendTransaction', params: [{ to: '0x1111111111111111111111111111111111111111', data: '0x1234' }],
  }), '0x' + 'a'.repeat(64));
  assert.deepEqual(calls, ['eth_accounts', 'eth_accounts', 'eth_sendTransaction']);
});

test('swap signer reuses the restored Trust provider without requesting a new dApp connection', async () => {
  const calls = [];
  const provider = {
    request: async ({ method }) => {
      calls.push(method);
      if (method === 'eth_accounts') return [account];
      throw new Error(`unexpected provider method ${method}`);
    },
  };
  const context = vm.createContext({
    window: {},
    localStorage: { getItem: () => null },
    gwActiveSigningProvider: () => provider,
    gwAddrOk: (address) => typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address),
    gwWcSessionAddress: () => '',
    console,
  });
  vm.runInContext(extractFunction('gwEnsureSigningForSwap'), context);

  assert.equal(await context.gwEnsureSigningForSwap({ silent: true }), provider);
  assert.deepEqual(calls, ['eth_accounts']);
});
