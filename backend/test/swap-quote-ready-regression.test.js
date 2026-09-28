import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const walletSrc = readFileSync(join(__dirname, '../../frontend/public/grom-wallet.js'), 'utf8');

function extractFn(name) {
  const marker = `function ${name}(`;
  const start = walletSrc.indexOf(marker);
  assert.notEqual(start, -1, `missing ${name}`);
  let body = walletSrc.indexOf('{', start);
  let depth = 0;
  for (let i = body; i < walletSrc.length; i += 1) {
    if (walletSrc[i] === '{') depth += 1;
    if (walletSrc[i] === '}') {
      depth -= 1;
      if (depth === 0) return walletSrc.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

describe('Instant Swap executable quote readiness', () => {
  it('defines gwDsSetQuoteExecReady before the quote painter calls it', () => {
    const def = walletSrc.indexOf('function gwDsSetQuoteExecReady(');
    const painter = walletSrc.indexOf('async function gwDsRefreshRate(');
    assert.ok(def >= 0);
    assert.ok(painter > def);
  });

  it('keeps the readiness helper in the production build guard', () => {
    const buildSrc = readFileSync(join(__dirname, '../../scripts/build-frontend.mjs'), 'utf8');
    assert.match(buildSrc, /\['\(\?:async \)\?function', 'gwDsSetQuoteExecReady'\]/);
  });

  it('does not reference the removed gwGetEip1193 helper', () => {
    assert.doesNotMatch(walletSrc, /\bgwGetEip1193\b/);
    assert.match(walletSrc, /gwIsRemoteWcSigner\(gwActiveSigningProvider\(\) \|\| window\.ethereum\)/);
  });

  it('sets the readiness flag, reason, and refreshes the CTA', () => {
    let syncCalls = 0;
    const context = vm.createContext({
      window: {},
      gwDsSyncCtaState() { syncCalls += 1; },
    });
    vm.runInContext(extractFn('gwDsSetQuoteExecReady'), context);
    context.gwDsSetQuoteExecReady(true, 'ready');
    assert.equal(context.window.__gwDsQuoteExecReady, true);
    assert.equal(context.window.__gwDsQuoteExecReason, 'ready');
    assert.equal(syncCalls, 1);
    context.gwDsSetQuoteExecReady(false);
    assert.equal(context.window.__gwDsQuoteExecReady, false);
    assert.equal(context.window.__gwDsQuoteExecReason, '');
    assert.equal(syncCalls, 2);
  });
});
