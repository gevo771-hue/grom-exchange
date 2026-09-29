/**
 * RR6-02 — Frontend Solana Jupiter path must not call jup.ag after backend errors.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const walletPath = join(__dirname, '../../frontend/public/grom-wallet.js');

function extractFunction(src, name) {
  const start = src.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const sigEnd = src.indexOf(')', start);
  assert.ok(sigEnd > start, `${name} signature`);
  let i = src.indexOf('{', sigEnd);
  assert.ok(i > sigEnd, `${name} body`);
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

describe('RR6 frontend Jupiter no-direct-fallback', () => {
  it('source has no direct Jupiter endpoints in exec path', () => {
    const src = readFileSync(walletPath, 'utf8');
    assert.equal(/GW_JUP_ENDPOINTS/.test(src), false);
    assert.equal(/api\.jup\.ag\/swap/.test(src), false);
    assert.equal(/lite-api\.jup\.ag/.test(src), false);
    assert.equal(/api\.odos\.xyz/.test(src), false);
    assert.match(src, /\/api\/wallet\/jup-quote/);
    assert.match(src, /\/api\/wallet\/jup-swap/);
    assert.match(src, /function gwJupiterReady/);
    assert.equal(/function gwJupFeeAccount\b/.test(src), false);
  });

  it('gwSolQuote/gwSolSwap are backend-only and treat 503 as terminal', () => {
    const src = readFileSync(walletPath, 'utf8');
    const quoteFn = extractFunction(src, 'gwSolQuote');
    const swapFn = extractFunction(src, 'gwSolSwap');

    assert.equal(/jup\.ag/i.test(quoteFn), false, 'quote must not reference jup.ag');
    assert.equal(/jup\.ag/i.test(swapFn), false, 'swap must not reference jup.ag');
    assert.match(quoteFn, /jup-quote|GW_JUP_BACKEND_QUOTE/);
    assert.match(swapFn, /jup-swap|GW_JUP_BACKEND_SWAP/);
    assert.match(quoteFn, /status === 429 \|\| r\.status === 502 \|\| r\.status === 503/);
    assert.match(swapFn, /status === 429 \|\| r\.status === 502 \|\| r\.status === 503/);
    assert.match(quoteFn, /gwJupiterReady/);
    assert.match(swapFn, /gwJupiterReady/);
    /* No retry loop over external hosts after backend failure */
    assert.equal(/for\s*\(.*of\s*GW_/.test(quoteFn), false);
    assert.equal(/for\s*\(.*of\s*GW_/.test(swapFn), false);
  });
});
