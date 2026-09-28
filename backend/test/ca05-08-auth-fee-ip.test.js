import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { publicClientFeeFlags } from '../src/liquidity/lifi-proxy.js';
import { clientIp } from '../src/admin/audit.js';

describe('CA-07 / CA-08 client fee + IP', () => {
  it('ignores skipFee/noFee from public client body', () => {
    assert.deepEqual(publicClientFeeFlags({ skipFee: true, noFee: true }), { skipFee: false });
    assert.deepEqual(publicClientFeeFlags({}), { skipFee: false });
  });

  it('does not trust spoofed CF header from untrusted peer', () => {
    const req = {
      socket: { remoteAddress: '203.0.113.9' },
      headers: { 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '1.2.3.4' },
      ip: '203.0.113.9',
    };
    /* With default trustedProxies = loopback only, peer 203.0.113.9 is untrusted */
    const ip = clientIp(req);
    assert.equal(ip, '203.0.113.9');
  });

  it('trusts CF header from loopback peer', () => {
    const req = {
      socket: { remoteAddress: '127.0.0.1' },
      headers: { 'cf-connecting-ip': '198.51.100.10' },
      ip: '127.0.0.1',
    };
    assert.equal(clientIp(req), '198.51.100.10');
  });
});

describe('CA-05 SIWE domain config present', () => {
  it('config exposes siweDomain for verify', async () => {
    const config = (await import('../src/config/index.js')).default;
    assert.ok(typeof config.wallet.siweDomain === 'string');
    assert.ok(config.wallet.siweDomain.length > 0);
  });
});
