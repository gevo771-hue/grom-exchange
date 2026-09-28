/**
 * CUT-01…07 + RE-CUT-01…07 — migration, fee fail-closed, Send/Receive, CEX purge, syntax.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const __dir = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dir, '..');
const repoRoot = join(backendRoot, '..');
const migDir = join(backendRoot, 'src', 'db', 'migrations');
const publicDir = join(repoRoot, 'frontend', 'public');
const envExample = join(repoRoot, '.env.example');

function loadWalletSrc() {
  return readFileSync(join(publicDir, 'grom-wallet.js'), 'utf8');
}

function evalFeeHelpers(src) {
  const start = src.indexOf('const GW_REQUIRED_FEE_BPS');
  assert.ok(start > 0, 'GW_REQUIRED_FEE_BPS missing');
  const end = src.indexOf('try {\n  window.gwIsFeeVerified', start);
  assert.ok(end > start, 'gwIsFeeVerified export missing');
  const fnSrc = src.slice(start, end);
  const gwSwapFeeReceiver = () => '0xCFeF272536D6E91A4945063d40ac7CbA7Eb657B5';
  const gwOdosReferralCode = () => 1;
  // eslint-disable-next-line no-new-func
  return new Function(
    'gwSwapFeeReceiver',
    'gwOdosReferralCode',
    `${fnSrc}; return { gwIsFeeVerified, gwVerifyLifiFee, gwVerifyParaswapFee, gwVerifyKyberFee, gwVerifyOdosFee, gwParaswapFeeToBps };`
  )(gwSwapFeeReceiver, gwOdosReferralCode);
}

describe('CUT-01 / RE-CUT-04 migration 027–029', () => {
  it('028+029 live in migrator directory', () => {
    const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
    assert.ok(files.includes('028_decommission_custodial.sql'), files.join(','));
    assert.ok(files.includes('029_remove_custodial_schema.sql'), files.join(','));
    assert.ok(files.includes('027_wallet_signature_withdrawals.sql'));
    const sql028 = readFileSync(join(migDir, '028_decommission_custodial.sql'), 'utf8');
    assert.match(sql028, /INSERT OR UPDATE OR DELETE/);
    assert.match(sql028, /terminal_xfer|NOT IN|<> ALL/);
    assert.match(sql028, /grom_block_custodial_write/);
    const sql029 = readFileSync(join(migDir, '029_remove_custodial_schema.sql'), 'utf8');
    assert.match(sql029, /DROP TABLE IF EXISTS wallet_transfers/);
    assert.match(sql029, /DROP TABLE IF EXISTS withdrawal_queue/);
    assert.match(sql029, /DROP FUNCTION IF EXISTS grom_block_custodial_write/);
    assert.doesNotMatch(sql029, /DROP TABLE IF EXISTS spot_orders/);
    assert.equal(
      existsSync(join(backendRoot, 'migrations', '028_decommission_custodial.sql')),
      false,
      'orphan backend/migrations/028 must be removed'
    );
  });

  it('027 does not hard-FK missing wallet_transfers', () => {
    const sql = readFileSync(join(migDir, '027_wallet_signature_withdrawals.sql'), 'utf8');
    assert.doesNotMatch(sql, /REFERENCES\s+wallet_transfers/i);
    assert.match(sql, /information_schema\.tables[\s\S]*wallet_transfers/);
  });

  it('028 fail-closed on unknown transfer status (allowlist terminal)', () => {
    const sql = readFileSync(join(migDir, '028_decommission_custodial.sql'), 'utf8');
    assert.match(sql, /terminal_xfer/);
    assert.match(sql, /status IS NULL/);
    assert.match(sql, /completed.*failed.*cancelled/s);
  });

  it('029 fail-closed before DROP', () => {
    const sql = readFileSync(join(migDir, '029_remove_custodial_schema.sql'), 'utf8');
    assert.match(sql, /029_remove_custodial_blocked/);
    assert.match(sql, /non-zero live balances/);
    assert.match(sql, /status IS NULL/);
  });
});

const SHIPPED_JS = readdirSync(publicDir)
  .filter((n) => n.endsWith('.js') && !n.includes('bundle'))
  .filter((n) => existsSync(join(publicDir, n)));

describe('RE-CUT-01 shipped JS syntax gate', () => {
  for (const name of SHIPPED_JS) {
    it(`node --check ${name}`, () => {
      const r = spawnSync(process.execPath, ['--check', join(publicDir, name)], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr || r.stdout);
    });
  }
});

const FORBIDDEN_SUBSTR = [
  'api.binance.com',
  'stream.binance.com',
  'api.coinbase.com',
  'api.kraken.com',
  'binanceP2P',
  'bybitP2P',
  '/api/wallet/deposit-address',
  '/api/wallet/withdrawals',
  '/api/wallet/whitelist',
  '/api/wallet/__removed_withdrawals',
  '/api/swap/convert/quote',
  '/api/swap/convert/accept',
  '/auth/email-login',
  'HOT_WALLET_EVM_KEY',
  'BTC_HOT_WALLET_WIF',
  'GROM_KRAKEN_API_KEY',
  'GROM_COINBASE_API_KEY',
  'GROM_BINANCE_API_KEY',
  'GROM_HUMMINGBOT_API',
];

const SCAN_TARGETS = [
  ...SHIPPED_JS.map((n) => join(publicDir, n)),
  join(publicDir, 'index.html'),
  envExample,
  join(backendRoot, 'src', 'config', 'index.js'),
].filter(existsSync);

describe('CUT-07 / RE-CUT-07 remnant ban (shipped + config)', () => {
  for (const path of SCAN_TARGETS) {
    const label = path.replace(repoRoot + '/', '');
    it(`${label} has no forbidden CEX/custodial substrings`, () => {
      const txt = readFileSync(path, 'utf8');
      for (const s of FORBIDDEN_SUBSTR) {
        assert.equal(txt.includes(s), false, `${label} contains ${s}`);
      }
    });
  }

  it('keeps Coinbase Wallet + Binance Web3 connectors and BSC', () => {
    const txt = loadWalletSrc();
    assert.match(txt, /Coinbase|connectCoinbase|bnw3|Binance Web3|connectBinanceWeb3/);
    assert.match(txt, /\b56\b/);
  });

  it('Instant Swap uses the on-chain quote executor and has no Convert API', () => {
    const txt = loadWalletSrc();
    const start = txt.indexOf('async function gwDsSubmit');
    assert.ok(start > 0);
    const chunk = txt.slice(start, start + 18000);
    assert.match(chunk, /window\.__gwDsQuoteExecReady|gwOnChainSwapExecMeta|execResult/);
    assert.doesNotMatch(txt, /convert\/quote|convert\/accept/);
  });

  it('legacy Receive/deposit runtime is physically absent', () => {
    const txt = loadWalletSrc();
    assert.doesNotMatch(txt, /gromDepLoadAddress|origLoadAddress\.apply|deposit-address/);
    assert.doesNotMatch(txt, /self-custody patch failed, falling back/);
  });

  it('wallet-native Send remains EVM-only and uses exact base units', () => {
    const txt = loadWalletSrc();
    const start = txt.indexOf('async function gwSubmitSend');
    assert.ok(start > 0);
    const chunk = txt.slice(start, start + 7000);
    assert.match(chunk, /gwAmtToBaseUnits|gwParseAmountToUnits/);
    assert.match(chunk, /EVM 0x… addresses only|kind === 'evm'/);
    assert.doesNotMatch(chunk, /Math\.round\(amt\s*\*/);
    assert.match(txt, /function gwSendAssetsForActiveChain/);
  });

  it('no inline no-fee DEX fallback in fee path', () => {
    const txt = loadWalletSrc();
    assert.doesNotMatch(txt, /Aggregators reverted — trying DEX router/);
    assert.match(txt, /Inline DEX fallback retired|No fee-verified route available/);
    const meta = txt.slice(txt.indexOf('async function gwOnChainSwapExecMeta'), txt.indexOf('async function gwOnChainSwapExecMeta') + 12000);
    assert.doesNotMatch(meta, /gwOnChainSwapExecInline\s*\(/);
  });
});

describe('RE-CUT-03 fee verification (strict, no self-assert)', () => {
  it('rejects self-asserted flags and unrelated LI.FI fees', () => {
    const { gwIsFeeVerified } = evalFeeHelpers(loadWalletSrc());
    assert.equal(gwIsFeeVerified(null), false);
    assert.equal(gwIsFeeVerified({ _gromFeeBps: 20, aggregator: 'Paraswap' }), false);
    assert.equal(gwIsFeeVerified({ _gromFeeBps: 20, aggregator: 'Paraswap', _psFeeOk: true }), false);
    assert.equal(gwIsFeeVerified({ _gromFeeBps: 20, aggregator: 'LiFi', _lifiFeeVerified: true }), false);
    assert.equal(
      gwIsFeeVerified({
        aggregator: 'LiFi',
        raw: { estimate: { feeCosts: [{ name: 'Bridge fee', amountUSD: '1.2', included: true }] } },
      }),
      false
    );
    assert.equal(
      gwIsFeeVerified({
        aggregator: 'LiFi',
        _gromFeeContext: {
          provider: 'lifi',
          feeAddress: '0xCFeF272536D6E91A4945063d40ac7CbA7Eb657B5',
          feeBps: 20,
          feePct: 0.002,
        },
        raw: {
          estimate: {
            feeCosts: [{ name: 'Integrator Fee', percentage: '0.002', amountUSD: '1.2', included: true }],
          },
        },
      }),
      true
    );
    assert.equal(
      gwIsFeeVerified({
        aggregator: 'Paraswap',
        _psPriceRoute: {
          destAmount: '2654318',
          destAmountAfterFee: '2653787',
          partner: 'grom-exchange',
          partnerFee: 0.2,
        },
      }),
      true
    );
    assert.equal(
      gwIsFeeVerified({
        aggregator: 'Paraswap',
        _gromFeeContext: {
          provider: 'paraswap',
          feeAddress: '0xCFeF272536D6E91A4945063d40ac7CbA7Eb657B5',
          feeBps: 20,
        },
        _psPriceRoute: {
          destAmount: '1000',
          partnerFeeBps: 20,
          partnerAddress: '0x0000000000000000000000000000000000000001',
        },
      }),
      false
    );
  });
});

describe('RR2 fee fixtures (schema-aware)', () => {
  const fixDir = join(__dir, 'fixtures', 'aggregator-fees');
  const recv = '0xCFeF272536D6E91A4945063d40ac7CbA7Eb657B5';
  it('LI.FI accepts percentage 0.002 with context; ignores token.address as recipient', () => {
    const { gwIsFeeVerified } = evalFeeHelpers(loadWalletSrc());
    const ok = JSON.parse(readFileSync(join(fixDir, 'lifi-integrator-ok.json'), 'utf8'));
    assert.equal(
      gwIsFeeVerified({
        aggregator: 'LiFi',
        _gromFeeContext: { provider: 'lifi', feeAddress: recv, feeBps: 20, feePct: 0.002 },
        raw: ok,
      }),
      true
    );
    // Same USDC token.address must NOT be compared to treasury — still true above.
    // Without percentage → reject
    assert.equal(
      gwIsFeeVerified({
        aggregator: 'LiFi',
        _gromFeeContext: { provider: 'lifi', feeAddress: recv, feeBps: 20, feePct: 0.002 },
        raw: { estimate: { feeCosts: [{ name: 'Integrator Fee', amountUSD: '1.2', included: true }] } },
      }),
      false
    );
    const bad = JSON.parse(readFileSync(join(fixDir, 'lifi-bridge-fee-reject.json'), 'utf8'));
    assert.equal(
      gwIsFeeVerified({
        aggregator: 'LiFi',
        _gromFeeContext: { provider: 'lifi', feeAddress: recv, feeBps: 20, feePct: 0.002 },
        raw: bad,
      }),
      false
    );
  });
  it('LI.FI accepts Fixed Fee + feeSplit.recipients grom-exchange (20 bps integrator share)', () => {
    const { gwIsFeeVerified } = evalFeeHelpers(loadWalletSrc());
    const ok = JSON.parse(readFileSync(join(fixDir, 'lifi-fixed-fee-split-ok.json'), 'utf8'));
    assert.equal(
      gwIsFeeVerified({
        aggregator: 'LiFi · Bridge',
        _gromFeeContext: {
          provider: 'lifi',
          feeAddress: recv,
          feeBps: 20,
          feePct: 0.002,
          integrator: 'grom-exchange',
        },
        raw: ok,
      }),
      true
    );
    // Wrong integrator share (10 bps) → reject
    const badSplit = JSON.parse(JSON.stringify(ok));
    badSplit.estimate.feeCosts[0].feeSplit.integratorFee = '10000';
    badSplit.estimate.feeCosts[0].feeSplit.recipients[1].fee = '10000';
    assert.equal(
      gwIsFeeVerified({
        aggregator: 'LiFi · Bridge',
        _gromFeeContext: {
          provider: 'lifi',
          feeAddress: recv,
          feeBps: 20,
          feePct: 0.002,
          integrator: 'grom-exchange',
        },
        raw: badSplit,
      }),
      false
    );
  });
  it('ParaSwap accepts live partnerFee 0.2 (=20 bps) Velora shape', () => {
    const { gwIsFeeVerified, gwParaswapFeeToBps } = evalFeeHelpers(loadWalletSrc());
    const fix = JSON.parse(readFileSync(join(fixDir, 'paraswap-live-partnerfee-0.2.json'), 'utf8'));
    assert.equal(gwParaswapFeeToBps(fix.priceRoute), 20);
    assert.equal(
      gwIsFeeVerified({
        aggregator: 'Paraswap',
        _psPriceRoute: fix.priceRoute,
      }),
      true
    );
    // partnerFee treated as bps incorrectly would fail:
    assert.equal(
      gwIsFeeVerified({
        aggregator: 'Paraswap',
        _psPriceRoute: { ...fix.priceRoute, partnerFee: 20, destAmountAfterFee: '1' },
      }),
      false
    );
  });
  it('Squid requires fee===45 bps echo (not a decimal fraction)', () => {
    const { gwIsFeeVerified } = evalFeeHelpers(loadWalletSrc());
    const fix = JSON.parse(readFileSync(join(fixDir, 'squid-collect-fees-echo.json'), 'utf8'));
    assert.equal(
      gwIsFeeVerified({ aggregator: 'Squid', raw: fix }),
      true
    );
    assert.equal(
      gwIsFeeVerified({
        aggregator: 'Squid',
        raw: { route: { params: { collectFees: { integratorAddress: recv, fee: 0.002 } } } },
      }),
      false
    );
  });
});


function dbUrlFromEnv() {
  return (
    process.env.DATABASE_URL
    || process.env.GROM_DB_URL
    || (process.env.GROM_DB_HOST
      ? `postgres://${encodeURIComponent(process.env.GROM_DB_USER || 'grom')}:${encodeURIComponent(process.env.GROM_DB_PASSWORD || '')}@${process.env.GROM_DB_HOST}:${process.env.GROM_DB_PORT || 5432}/${process.env.GROM_DB_NAME || 'grom'}`
      : '')
  );
}

const hasDb = !!dbUrlFromEnv();
const requirePg = process.env.CI === 'true' || process.env.GROM_REQUIRE_PG === '1';
if (requirePg && !hasDb) {
  throw new Error('PostgreSQL required (set DATABASE_URL / GROM_DB_URL)');
}
const describeDb = hasDb ? describe : describe.skip;

describeDb('RE-CUT-04 clean PostgreSQL migration chain', () => {
  it('applies all migrations 001→032 on empty database', async () => {
    const baseUrl = dbUrlFromEnv();
    const admin = new pg.Client({ connectionString: baseUrl });
    await admin.connect();
    const dbName = `grom_mig_${Date.now()}`;
    try {
      await admin.query(`CREATE DATABASE ${dbName}`);
    } finally {
      await admin.end();
    }
    const u = new URL(baseUrl);
    u.pathname = `/${dbName}`;
    const client = new pg.Client({ connectionString: u.toString() });
    await client.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        const sql = readFileSync(join(migDir, file), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      }
      const { rows } = await client.query('SELECT version FROM schema_migrations ORDER BY version');
      assert.ok(rows.some((r) => r.version.startsWith('002_')));
      assert.ok(rows.some((r) => r.version.startsWith('028_')));
      assert.ok(rows.some((r) => r.version.startsWith('029_')));
      assert.ok(rows.some((r) => r.version.startsWith('030_')));
      assert.ok(rows.some((r) => r.version.startsWith('031_')));
      assert.ok(rows.some((r) => r.version.startsWith('032_')));
      assert.ok(rows.some((r) => r.version.startsWith('027_')));
      // After 030/031: custodial/BO/spot ledger + dead challenges gone; users remain
      for (const table of [
        'balances', 'spot_orders', 'bo_rounds', 'bo_positions', 'bo_ledger',
        'wallet_transfers', 'withdrawal_queue', 'deposit_addresses', 'address_whitelist',
        'wallet_action_challenges', 'notifications_outbox', 'symbols', 'alerts',
      ]) {
        const { rows } = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
          [table],
        );
        assert.equal(rows.length, 0, `${table} must be dropped by 029/030/031`);
      }
      for (const table of ['users', 'user_settings', 'admin_audit_log']) {
        const { rows } = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
          [table],
        );
        assert.equal(rows.length, 1, `${table} must exist`);
      }
    } finally {
      await client.end();
      const drop = new pg.Client({ connectionString: baseUrl });
      await drop.connect();
      await drop.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() =>
        drop.query(`DROP DATABASE IF EXISTS ${dbName}`)
      );
      await drop.end();
    }
  });

  it('028 blocks on non-zero live balances and unknown transfer status', async () => {
    const baseUrl = dbUrlFromEnv();
    const admin = new pg.Client({ connectionString: baseUrl });
    await admin.connect();
    const dbName = `grom_mig_block_${Date.now()}`;
    try {
      await admin.query(`CREATE DATABASE ${dbName}`);
    } finally {
      await admin.end();
    }
    const u = new URL(baseUrl);
    u.pathname = `/${dbName}`;
    const client = new pg.Client({ connectionString: u.toString() });
    await client.connect();
    try {
      const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
        .filter((f) => !f.startsWith('028_') && !f.startsWith('029_') && !f.startsWith('030_'));
      for (const file of files) {
        await client.query(readFileSync(join(migDir, file), 'utf8'));
      }
      // Staging fixture: non-zero live balance
      await client.query(`
        INSERT INTO users (id, wallet_address, chain_id)
        VALUES ('00000000-0000-0000-0000-000000000001', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 1)
        ON CONFLICT DO NOTHING
      `);
      await client.query(`
        INSERT INTO balances (user_id, asset, mode, amount, locked)
        VALUES ('00000000-0000-0000-0000-000000000001', 'USDT', 'live', 1, 0)
        ON CONFLICT DO NOTHING
      `);
      let blocked = false;
      try {
        await client.query(readFileSync(join(migDir, '028_decommission_custodial.sql'), 'utf8'));
      } catch (e) {
        blocked = /028_decommission_blocked|non-zero live balances/i.test(String(e.message || e));
      }
      assert.equal(blocked, true, '028 must block on live balances');
    } finally {
      await client.end();
      const drop = new pg.Client({ connectionString: baseUrl });
      await drop.connect();
      await drop.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() =>
        drop.query(`DROP DATABASE IF EXISTS ${dbName}`)
      );
      await drop.end();
    }
  });
});

describeDb('RR2-07 unknown transfer / queue fixtures', () => {
  it('028/029 block on NULL/unknown wallet_transfers status', async () => {
    const baseUrl = dbUrlFromEnv();
    const admin = new pg.Client({ connectionString: baseUrl });
    await admin.connect();
    const dbName = `grom_mig_unk_${Date.now()}`;
    try { await admin.query(`CREATE DATABASE ${dbName}`); } finally { await admin.end(); }
    const u = new URL(baseUrl);
    u.pathname = `/${dbName}`;
    const client = new pg.Client({ connectionString: u.toString() });
    await client.connect();
    try {
      const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
        .filter((f) => !f.startsWith('028_') && !f.startsWith('029_') && !f.startsWith('030_'));
      for (const file of files) {
        await client.query(readFileSync(join(migDir, file), 'utf8'));
      }
      // Create legacy table with unknown status
      await client.query(`
        CREATE TABLE IF NOT EXISTS wallet_transfers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          status TEXT
        )
      `);
      await client.query(`INSERT INTO wallet_transfers (status) VALUES ('weird_new_status')`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS withdrawal_queue (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          status TEXT
        )
      `);
      await client.query(`INSERT INTO withdrawal_queue (status) VALUES (NULL)`);
      let blocked = false;
      try {
        await client.query(readFileSync(join(migDir, '028_decommission_custodial.sql'), 'utf8'));
      } catch (e) {
        blocked = /028_decommission_blocked|nonterminal/i.test(String(e.message || e));
      }
      assert.equal(blocked, true, '028 must block on unknown transfer status');
    } finally {
      await client.end();
      const drop = new pg.Client({ connectionString: baseUrl });
      await drop.connect();
      await drop.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() =>
        drop.query(`DROP DATABASE IF EXISTS ${dbName}`)
      );
      await drop.end();
    }
  });
});

describeDb('RR4-05 migration 030 fail-closed fixtures', () => {
  async function withDbUpTo(excludePrefixes, fn) {
    const baseUrl = dbUrlFromEnv();
    const admin = new pg.Client({ connectionString: baseUrl });
    await admin.connect();
    const dbName = `grom_mig_030_${Date.now()}_${Math.floor(Math.random()*1e4)}`;
    try { await admin.query(`CREATE DATABASE ${dbName}`); } finally { await admin.end(); }
    const u = new URL(baseUrl);
    u.pathname = `/${dbName}`;
    const client = new pg.Client({ connectionString: u.toString() });
    await client.connect();
    try {
      const files = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort()
        .filter((f) => !excludePrefixes.some((p) => f.startsWith(p)));
      for (const file of files) {
        await client.query(readFileSync(join(migDir, file), 'utf8'));
      }
      await fn(client);
    } finally {
      await client.end();
      const drop = new pg.Client({ connectionString: baseUrl });
      await drop.connect();
      await drop.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`).catch(() =>
        drop.query(`DROP DATABASE IF EXISTS ${dbName}`)
      );
      await drop.end();
    }
  }

  it('030 blocks on leftover bo_rounds rows', async () => {
    await withDbUpTo(['030_'], async (client) => {
      await client.query(`INSERT INTO bo_rounds (asset, duration_sec, open_at, close_at, expiry_at, status)
        VALUES ('BTC/USDT', 60, NOW(), NOW() + interval '1 minute', NOW() + interval '2 minutes', 'open')`);
      let errMsg = '';
      try {
        await client.query(readFileSync(join(migDir, '030_drop_custodial_ledger.sql'), 'utf8'));
      } catch (e) {
        errMsg = String(e.message || e);
      }
      assert.match(errMsg, /030_drop_blocked:\s*bo_rounds/i);
    });
  });

  it('030 blocks on leftover bo_ledger rows', async () => {
    await withDbUpTo(['030_'], async (client) => {
      const { rows: u } = await client.query(
        `INSERT INTO users (wallet_address, chain_id) VALUES ('0xcccccccccccccccccccccccccccccccccccccccc', 1) RETURNING id`
      );
      await client.query(
        `INSERT INTO bo_ledger (user_id, kind, amount, asset, mode, balance_after)
         VALUES ($1, 'adjustment', 1, 'USDT', 'demo', 1)`,
        [u[0].id],
      );
      let errMsg = '';
      try {
        await client.query(readFileSync(join(migDir, '030_drop_custodial_ledger.sql'), 'utf8'));
      } catch (e) {
        errMsg = String(e.message || e);
      }
      assert.match(errMsg, /030_drop_blocked:\s*bo_ledger/i);
    });
  });

  it('030 blocks on leftover bo_positions rows', async () => {
    await withDbUpTo(['030_'], async (client) => {
      const { rows: u } = await client.query(
        `INSERT INTO users (wallet_address, chain_id) VALUES ('0xdddddddddddddddddddddddddddddddddddddddd', 1) RETURNING id`
      );
      const { rows: r } = await client.query(
        `INSERT INTO bo_rounds (asset, duration_sec, open_at, close_at, expiry_at, status)
         VALUES ('ETH/USDT', 60, NOW(), NOW() + interval '1 minute', NOW() + interval '2 minutes', 'open')
         RETURNING id`
      );
      await client.query(
        `INSERT INTO bo_positions (round_id, user_id, direction, stake, asset, mode)
         VALUES ($1, $2, 'up', 10, 'USDT', 'demo')`,
        [r[0].id, u[0].id],
      );
      let errMsg = '';
      try {
        await client.query(readFileSync(join(migDir, '030_drop_custodial_ledger.sql'), 'utf8'));
      } catch (e) {
        errMsg = String(e.message || e);
      }
      assert.match(errMsg, /030_drop_blocked:\s*bo_positions/i);
    });
  });

  it('030 succeeds when ledger tables are empty', async () => {
    await withDbUpTo(['030_'], async (client) => {
      await client.query(readFileSync(join(migDir, '030_drop_custodial_ledger.sql'), 'utf8'));
      const { rows } = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='balances'`,
      );
      assert.equal(rows.length, 0);
    });
  });
});
