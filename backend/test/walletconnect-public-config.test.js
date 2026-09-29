import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walletConnectProjectIdForClient } from '../src/wallet/public-config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('WalletConnect public project config', () => {
  it('publishes only a well-formed public project id', () => {
    assert.equal(walletConnectProjectIdForClient('28302d1699a8833692b54f0454164625'), '28302d1699a8833692b54f0454164625');
    assert.equal(walletConnectProjectIdForClient('  ABCDEF0123456789ABCDEF0123456789  '), 'ABCDEF0123456789ABCDEF0123456789');
    assert.equal(walletConnectProjectIdForClient(''), null);
    assert.equal(walletConnectProjectIdForClient('not-a-project-id'), null);
  });

  it('loads the backend project id before initializing the WalletConnect client', () => {
    const source = readFileSync(join(root, 'frontend/public/grom-wallet.js'), 'utf8');
    const serverSource = readFileSync(join(root, 'backend/src/server.js'), 'utf8');
    const clientStart = source.indexOf('async function gwWcClient()');
    const initCall = source.indexOf('SignClient.init(initOpts)', clientStart);
    assert.ok(clientStart >= 0, 'WalletConnect initializer exists');
    assert.ok(initCall > clientStart, 'SignClient initialization exists');
    assert.ok(
      source.indexOf('await gwEnsureFeeConfig()', clientStart) < initCall,
      'public backend config must load before SignClient.init',
    );
    assert.ok(
      serverSource.includes('walletConnectProjectId: walletConnectProjectIdForClient(config.wallet?.walletConnectProjectId)'),
      'backend exposes only the validated public project id',
    );
    assert.ok(source.includes('WC_PROJECT_ID = wcProjectId;'), 'frontend adopts the backend project id');
    assert.ok(source.includes("cache: 'no-store'"), 'frontend must not reuse stale public config');
  });
});
