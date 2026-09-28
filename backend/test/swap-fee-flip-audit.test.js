import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const walletSrc = readFileSync(join(__dirname, '../../frontend/public/grom-wallet.js'), 'utf8');

describe('swap audit fee wiring (static)', () => {
  it('KyberSwap quote includes fee params', () => {
    assert.match(walletSrc, /chargeFeeBy:\s*'currency_out'/);
    assert.match(walletSrc, /feeReceiver:\s*gwSwapFeeReceiver\(\)/);
    assert.match(walletSrc, /feeAmount:\s*String\(gwSwapFeeBps\(\)\)/);
    assert.match(walletSrc, /isInBps:\s*'true'/);
  });

  it('Paraswap quote includes partner fee', () => {
    assert.match(walletSrc, /partnerFeeBps:\s*String\(gwSwapFeeBps\(\)\)/);
    assert.match(walletSrc, /partnerAddress:\s*gwSwapFeeReceiver\(\)/);
  });

  it('shared fee receiver is treasury', () => {
    assert.match(walletSrc, /GW_SWAP_FEE_BPS\s*=\s*20/);
    assert.match(walletSrc, /0xCFeF272536D6E91A4945063d40ac7CbA7Eb657B5/);
  });

  it('LiFi 1011 / lifi_fee_unavailable is terminal (no fee-strip retry)', () => {
    assert.match(walletSrc, /not configured for collecting fees|code\["\\s:\]\*1011/);
    assert.match(walletSrc, /lifi_fee_unavailable/);
    assert.match(walletSrc, /gwLifiMarkFeeUnavailable/);
    assert.doesNotMatch(walletSrc, /__gwLifiFeeDisabled/);
    assert.doesNotMatch(walletSrc, /fetchLifiQuote\(false\)/);
  });

  it('flip syncs token buttons + user picks', () => {
    assert.match(walletSrc, /gwTkSyncButton\('from'\);\s*gwTkSyncButton\('to'\)/);
    assert.match(walletSrc, /__gwDsUserPickedFrom/);
  });
});
