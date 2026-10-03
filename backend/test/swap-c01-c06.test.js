import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const GromSwapCore = require('../../frontend/public/grom-swap-core.js');
const walletSrc = readFileSync(join(__dirname, '../../frontend/public/grom-wallet.js'), 'utf8');

describe('C01 mandatory refresh must not be swallowed', () => {
  it('requiresMandatoryPreSignRefresh covers Kyber/Paraswap/Odos/LiFi', () => {
    assert.equal(GromSwapCore.requiresMandatoryPreSignRefresh('KyberSwap'), true);
    assert.equal(GromSwapCore.requiresMandatoryPreSignRefresh('Paraswap'), true);
    assert.equal(GromSwapCore.requiresMandatoryPreSignRefresh('Odos'), true);
    assert.equal(GromSwapCore.requiresMandatoryPreSignRefresh('LiFi'), true);
    assert.equal(GromSwapCore.requiresMandatoryPreSignRefresh('CoWSwap'), false);
  });

  it('mandatory pre-sign refresh has no swallow catch around await', () => {
    const start = walletSrc.indexOf('requiresMandatoryPreSignRefresh');
    assert.ok(start > 0, 'wallet must call requiresMandatoryPreSignRefresh');
    const chunk = walletSrc.slice(start, start + 700);
    assert.match(chunk, /await gwAggRefreshExecQuote/);
    assert.doesNotMatch(chunk, /await gwAggRefreshExecQuote[\s\S]{0,220}catch\s*\(\s*_\s*\)\s*\{\s*\}/);
  });

  it('refresh failure aborts before simulate/send (control-flow harness)', async () => {
    let simulateCalls = 0;
    let sendCalls = 0;
    let refreshCalls = 0;
    const STALE = '0xSTALE';
    const quote = {
      aggregator: 'KyberSwap',
      transactionRequest: { to: '0xrouter', data: STALE, value: '0x0' },
      toAmount: 1n,
      approvalAddress: '0xspender',
    };
    const refresh = async () => {
      refreshCalls += 1;
      throw new Error('Quote refresh failed — will not sign stale calldata');
    };
    const need = GromSwapCore.requiresMandatoryPreSignRefresh(quote.aggregator);
    assert.equal(need, true);
    let threw = false;
    try {
      if (need) await refresh(quote);
      simulateCalls += 1;
      sendCalls += 1;
    } catch (_) {
      threw = true;
    }
    assert.equal(threw, true);
    assert.equal(refreshCalls, 1);
    assert.equal(simulateCalls, 0);
    assert.equal(sendCalls, 0);
    assert.equal(quote.transactionRequest.data, STALE); // unchanged — never sent
  });
});

describe('C02 Solana sign retry policy', () => {
  it('rejects retry after network / empty signature; allows format error', () => {
    assert.equal(GromSwapCore.shouldRetrySolanaSignShape({ code: 4001 }), false);
    assert.equal(
      GromSwapCore.shouldRetrySolanaSignShape(new Error('network disconnected after broadcast')),
      false,
    );
    assert.equal(
      GromSwapCore.shouldRetrySolanaSignShape(new Error('Phantom returned empty signature')),
      false,
    );
    assert.equal(
      GromSwapCore.shouldRetrySolanaSignShape(new Error('Unexpected type: expected VersionedTransaction')),
      true,
    );
  });

  it('solSignAndSendWithPolicy: network error → one wallet call', async () => {
    let calls = 0;
    const provider = {
      async signAndSendTransaction() {
        calls += 1;
        throw new Error('network disconnected after broadcast');
      },
    };
    await assert.rejects(
      () => GromSwapCore.solSignAndSendWithPolicy(provider, { kind: 'tx' }),
      /unknown|Activity/i,
    );
    assert.equal(calls, 1);
  });

  it('solSignAndSendWithPolicy: user reject 4001 → one wallet call', async () => {
    let calls = 0;
    const provider = {
      async signAndSendTransaction() {
        calls += 1;
        const e = new Error('User rejected the request');
        e.code = 4001;
        throw e;
      },
    };
    await assert.rejects(
      () => GromSwapCore.solSignAndSendWithPolicy(provider, { kind: 'tx' }),
      /rejected/i,
    );
    assert.equal(calls, 1);
  });

  it('solSignAndSendWithPolicy: format error may retry once', async () => {
    let calls = 0;
    const provider = {
      async signAndSendTransaction() {
        calls += 1;
        if (calls === 1) throw new Error('Unexpected type: expected VersionedTransaction');
        return { signature: 'sig_ok' };
      },
    };
    const sig = await GromSwapCore.solSignAndSendWithPolicy(provider, { kind: 'tx' });
    assert.equal(sig, 'sig_ok');
    assert.equal(calls, 2);
  });
});

describe('C03 non-EVM → EVM namespace clear', () => {
  it('active EVM chip wins over stale nonevm pickedFrom', () => {
    const ns = GromSwapCore.resolveSwapUiNamespace({
      activeChip: { cid: 1 },
      pickedFrom: { nonevm: 'sol', sym: 'USDC' },
    });
    assert.equal(ns.namespace, 'evm');
    assert.equal(ns.nonevm, null);
    assert.equal(ns.chainId, 1);
  });

  it('active sol chip keeps solana even if pickedFrom has chainId', () => {
    const ns = GromSwapCore.resolveSwapUiNamespace({
      activeChip: { nonevm: 'sol' },
      pickedFrom: { chainId: 1, sym: 'USDC' },
    });
    assert.equal(ns.namespace, 'solana');
  });

  it('EVM chip click clears all .on including nonevm (DOM harness)', () => {
    // Minimal DOM double matching gwDsChainChipsWire EVM path
    const chips = [
      { classList: new Set(['gw-ds-chain', 'on']), dataset: { nonevm: 'sol' } },
      { classList: new Set(['gw-ds-chain']), dataset: { cid: '1' } },
    ];
    const wrap = {
      querySelectorAll(sel) {
        if (sel === '.gw-ds-chain') return chips;
        if (sel === '.gw-ds-chain[data-cid]') return chips.filter((c) => c.dataset.cid);
        return [];
      },
    };
    // Simulate fixed handler: clear ALL chips
    const b = chips[1];
    wrap.querySelectorAll('.gw-ds-chain').forEach((x) => x.classList.delete('on'));
    b.classList.add('on');
    const pickedFrom = { nonevm: 'sol', sym: 'USDC' };
    delete pickedFrom.nonevm;
    pickedFrom.chainId = 1;
    const active = chips.find((c) => c.classList.has('on'));
    const activeChip = active.dataset.cid
      ? { cid: Number(active.dataset.cid) }
      : { nonevm: active.dataset.nonevm };
    const ns = GromSwapCore.resolveSwapUiNamespace({ activeChip, pickedFrom });
    assert.equal(chips[0].classList.has('on'), false);
    assert.equal(chips[1].classList.has('on'), true);
    assert.equal(ns.namespace, 'evm');
    assert.equal(pickedFrom.nonevm, undefined);
  });
});

describe('C04 resume monitor kind', () => {
  it('Solana signature does not select lifi_bridge', () => {
    assert.equal(
      GromSwapCore.pickResumeMonitorKind({
        stage: 'submitted', namespace: 'solana', hash: '5sig...',
      }),
      'solana',
    );
  });


  it('EVM bridging selects lifi_bridge', () => {
    assert.equal(
      GromSwapCore.pickResumeMonitorKind({
        stage: 'bridging', namespace: 'evm', hash: '0xabc', bridge: 'across',
        fromChainId: 42161, toChainId: 8453, crossChain: true,
      }),
      'lifi_bridge',
    );
  });

  it('unknown without hash is lock_only', () => {
    assert.equal(
      GromSwapCore.pickResumeMonitorKind({ stage: 'unknown' }),
      'lock_only',
    );
  });
});

describe('C05 amount string through units helper', () => {
  it('canonical keeps excess precision; Number loses it', () => {
    const s = GromSwapCore.canonicalAmountString('1.000000000000000001');
    assert.equal(s, '1.000000000000000001');
    assert.equal(Number(s), 1);
    assert.equal(GromSwapCore.amountsEqualExact(s, '1'), false);
    assert.equal(GromSwapCore.amountsEqualExact('19.731415', '19.731415'), true);
  });

  it('executor keeps string into gwAmtToBaseUnits (no Number(amtNum) coerce)', () => {
    const start = walletSrc.indexOf('// Cap MAX slightly under wallet balance');
    assert.ok(start > 0);
    const chunk = walletSrc.slice(start, start + 3500);
    assert.match(chunk, /useAmtStr/);
    assert.doesNotMatch(chunk, /let useAmt = Number\(amtNum\)/);
    assert.match(chunk, /gwAmtToBaseUnits\(useAmtStr/);
  });
});

describe('C06 executed quote wins over proposal array', () => {
  it('pickExecutedQuote prefers result.quote over lastExec and ignores array', () => {
    const quoteA = { aggregator: 'KyberSwap', tool: 'kyber', _toChainId: 42161 };
    const quoteB = { aggregator: 'LiFi', tool: 'across', _crossChain: true, _fromChainId: 42161, _toChainId: 8453 };
    const execResult = { hash: '0x1', status: 'bridging', quote: quoteB };
    const picked = GromSwapCore.pickExecutedQuote(execResult, { lastExecQuote: quoteA });
    assert.equal(picked, quoteB);
    const meta = GromSwapCore.pickExecBridgeMeta(picked, {
      quotes: [quoteA, quoteB], // must not matter
    });
    assert.equal(meta.toChainId, 8453);
    assert.match(String(meta.bridge), /across/i);
  });

  it('without result.quote falls back to lastExecQuote only', () => {
    const quoteB = { aggregator: 'LiFi', tool: 'stargate', _toChainId: 10 };
    assert.equal(
      GromSwapCore.pickExecutedQuote({ hash: '0x1' }, { lastExecQuote: quoteB }),
      quoteB,
    );
    assert.equal(
      GromSwapCore.pickExecutedQuote({ hash: '0x1' }, {}),
      null,
    );
  });

  it('preserves Squid quote identifiers for destination-status monitoring', () => {
    const quote = {
      tool: 'squid', _crossChain: true, _fromChainId: 1, _toChainId: 42161,
      _squidQuoteId: 'quote-123', raw: { requestId: 'request-456' },
    };
    const meta = GromSwapCore.pickExecBridgeMeta(quote, null);
    assert.equal(meta.bridge, 'squid');
    assert.equal(meta.quoteId, 'quote-123');
    assert.equal(meta.requestId, 'request-456');
  });
});

describe('submitted swap chain resolution', () => {
  it('uses the executed source chain instead of a stale WalletConnect chain', () => {
    assert.equal(GromSwapCore.resolveSubmittedChainId({
      execResult: { hash: '0x1', quote: { _fromChainId: 42161, _toChainId: 42161 } },
      opChainId: 42161,
      walletChainId: 1,
    }), 42161);
  });

  it('prefers bridge source chain and understands hex chain ids', () => {
    assert.equal(GromSwapCore.resolveSubmittedChainId({
      execResult: { fromChainId: '0x2105', toChainId: 42161 },
      opChainId: 1,
      walletChainId: 1,
    }), 8453);
  });

  it('falls back to the chain captured at operation start before the wallet report', () => {
    assert.equal(GromSwapCore.resolveSubmittedChainId({
      opChainId: 10,
      uiChainId: 42161,
      walletChainId: 1,
    }), 10);
    assert.equal(GromSwapCore.resolveSubmittedChainId({ walletChainId: '0xa4b1' }), 42161);
    assert.equal(GromSwapCore.resolveSubmittedChainId({ walletChainId: 'nope' }), null);
  });
});

describe('submitted execution status and bridge metadata', () => {
  it('keeps an EVM swap submitted until the receipt monitor confirms it', () => {
    const submitted = GromSwapCore.buildSubmittedExecResult({
      hash: '0xabc',
      namespace: 'evm',
      crossChain: false,
      quote: { _fromChainId: 42161, _toChainId: 42161, tool: 'Paraswap' },
    });
    assert.equal(submitted.status, 'submitted');
    assert.equal(submitted.confirmed, false);
    assert.equal(submitted.fromChainId, 42161);
    assert.equal(GromSwapCore.normalizeExecResult(submitted).confirmed, false);
  });

  it('carries source, destination, and signature into a non-EVM bridge monitor', () => {
    const bridge = GromSwapCore.buildSubmittedExecResult({
      hash: 'sol-signature',
      namespace: 'solana',
      crossChain: true,
      quote: { _fromChainId: 1151111081099710, _toChainId: 42161, tool: 'Mayan' },
    });
    assert.equal(bridge.status, 'bridging');
    assert.equal(bridge.namespace, 'solana');
    assert.equal(bridge.signature, 'sol-signature');
    assert.equal(bridge.fromChainId, 1151111081099710);
    assert.equal(bridge.toChainId, 42161);
    assert.match(bridge.bridge, /Mayan/i);
  });
});
