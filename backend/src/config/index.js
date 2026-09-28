import 'dotenv/config';

const env = (key, fallback) => {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v;
};
const envInt = (key, fallback) => parseInt(env(key, fallback), 10);
const envFloat = (key, fallback) => parseFloat(env(key, fallback));
const envList = (key, fallback = '') => env(key, fallback).split(',').map(s => s.trim()).filter(Boolean);
const envBool = (key, fallback = false) => {
  const v = env(key, fallback ? '1' : '0');
  return v === '1' || v === 'true' || v === 'TRUE';
};

function parseDbConfig() {
  const dbUrl = env('DATABASE_URL', '');
  if (dbUrl) {
    try {
      const u = new URL(dbUrl);
      return {
        host: u.hostname,
        port: Number(u.port || 5432),
        database: decodeURIComponent(u.pathname.replace(/^\//, '') || 'grom'),
        user: decodeURIComponent(u.username || 'grom'),
        password: decodeURIComponent(u.password || ''),
        max: envInt('GROM_DB_POOL_MAX', 50),
        idleTimeoutMillis: 30_000,
      };
    } catch {
      throw new Error('Invalid DATABASE_URL');
    }
  }
  return {
    host: env('GROM_DB_HOST', 'localhost'),
    port: envInt('GROM_DB_PORT', 5432),
    database: env('GROM_DB_NAME', 'grom'),
    user: env('GROM_DB_USER', 'grom'),
    password: env('GROM_DB_PASSWORD', ''),
    max: envInt('GROM_DB_POOL_MAX', 50),
    idleTimeoutMillis: 30_000,
  };
}

function parseRedisConfig() {
  const redisUrl = env('REDIS_URL', '');
  if (redisUrl) {
    try {
      const u = new URL(redisUrl);
      return {
        host: u.hostname,
        port: Number(u.port || 6379),
        namespace: env('GROM_REDIS_NAMESPACE', 'grom:'),
        url: redisUrl,
      };
    } catch {
      throw new Error('Invalid REDIS_URL');
    }
  }
  return {
    host: env('GROM_REDIS_HOST', 'localhost'),
    port: envInt('GROM_REDIS_PORT', 6379),
    namespace: env('GROM_REDIS_NAMESPACE', 'grom:'),
    url: '',
  };
}

export const config = {
  env: env('NODE_ENV', 'development'),
  ports: {
    backend: envInt('GROM_BACKEND_PORT', 4000),
    ws:      envInt('GROM_WS_PORT', 4001),
    metrics: envInt('GROM_METRICS_PORT', 9464),
  },
  db: parseDbConfig(),
  redis: parseRedisConfig(),
  quoteCache: {
    ttlSec: envInt('GROM_QUOTE_CACHE_TTL_SEC', 8),
  },
  cluster: {
    /** 0 = pm2 `max` (all CPUs). Override for staging. */
    workers: envInt('GROM_CLUSTER_WORKERS', 0),
  },
  auth: {
    jwtSecret: env('GROM_JWT_SECRET', env('JWT_SECRET', 'insecure-dev-secret-change-me')),
    jwtTtl: envInt('GROM_JWT_TTL', 86400),
  },
  cors: { origin: env('GROM_CORS_ORIGIN', env('NEXT_PUBLIC_APP_URL', '*')) },
  liquidity: {
    oneinchKey: env('GROM_1INCH_API_KEY'),
    /** Secret LI.FI key; empty disables only LI.FI routes fail-closed. */
    lifiApiKey: env('LIFI_API_KEY', ''),
    odosUrl: env('GROM_ODOS_API_URL', 'https://api.odos.xyz'),
    /** Public (non-secret) aggregator fee identifiers published to the browser. */
    squidIntegratorId: env('GROM_SQUID_INTEGRATOR_ID', ''),
    /** Squid collectFees is expressed in basis points; GROM charges clients 45 bps. */
    squidFeeBps: envInt('GROM_SQUID_FEE_BPS', 45),
    odosReferralCode: envInt('GROM_ODOS_REFERRAL_CODE', 0),
    /**
     * Jupiter GROM fee mode — must be set explicitly (never inferred from missing env):
     *   free → Solana Instant Swap without platformFeeBps / feeAccount
     *   fee  → strict 20 bps + per-mint fee accounts + RPC verify
     * unset/invalid → Jupiter disabled (fail-closed)
     */
    jupiterFeeMode: env('GROM_JUP_FEE_MODE', ''),
    /** mint → SPL token account JSON map for Jupiter platform fees (required in fee mode) */
    jupiterFeeAccountsJson: env('GROM_JUP_FEE_ACCOUNTS_JSON', ''),
    /** Wallet pubkey that must own every fee token account (parsed.info.owner) */
    jupiterFeeOwner: env('GROM_JUP_FEE_OWNER', ''),
    /** Solana JSON-RPC for fee-account verification (required in fee mode) */
    solanaRpcUrl: env('SOLANA_RPC_URL', env('GROM_SOLANA_RPC', '')),
    feeReceiver: env('GROM_FEE_RECEIVER', '0xCFeF272536D6E91A4945063d40ac7CbA7Eb657B5'),
    feeBps: envInt('GROM_FEE_BPS', 20),
  },
  polymarket: {
    /** bytes32 builder code from polymarket.com → Settings → Builders (public attribution id) */
    builderCode: env('GROM_POLYMARKET_BUILDER_CODE', ''),
  },
  hyperliquid: {
    /** EVM address that receives builder fees (ApproveBuilderFee + order.builder.b) */
    builderAddress: env('GROM_HL_BUILDER_ADDRESS', ''),
    /** Fee in tenths of a basis point: 50 = 0.05% (perp cap 100 = 0.1%) */
    builderFeeTenthsBp: envInt('GROM_HL_BUILDER_FEE_TENTHS_BP', 50),
    /** Max fee string asked in ApproveBuilderFee (headroom above charge rate) */
    maxApproveFeePct: env('GROM_HL_MAX_APPROVE_FEE_PCT', '0.1%'),
    testnet: envBool('GROM_HL_TESTNET', false),
  },
  wallet: {
    walletConnectProjectId: env('GROM_WALLETCONNECT_PROJECT_ID', ''),
    supportedChains: envList('GROM_SUPPORTED_CHAINS', '1,137,56,42161,8453').map(Number),
    siweDomain: env('GROM_SIWE_DOMAIN', 'localhost:5273'),
    siweStatement: env('GROM_SIWE_STATEMENT', 'Sign in to GROM Finance Hub'),
  },
  /* Public RPC / explorer helpers for Instant Swap balances (no hot-wallet keys). */
  signers: {
    evm: {
      rpcByNetwork: {
        ETH: env('RPC_ETH', ''),
        ARB: env('RPC_ARB', ''),
        MATIC: env('RPC_MATIC', ''),
        BASE: env('RPC_BASE', ''),
        BSC: env('RPC_BSC', ''),
      },
      contracts: {
        ETH: { USDT: env('USDT_ETH_CONTRACT', ''), USDC: env('USDC_ETH_CONTRACT', '') },
        ARB: { USDT: env('USDT_ARB_CONTRACT', ''), USDC: env('USDC_ARB_CONTRACT', '') },
        MATIC: { USDT: env('USDT_MATIC_CONTRACT', ''), USDC: env('USDC_MATIC_CONTRACT', '') },
        BASE: { USDT: env('USDT_BASE_CONTRACT', ''), USDC: env('USDC_BASE_CONTRACT', '') },
        BSC: { USDT: env('USDT_BSC_CONTRACT', ''), USDC: env('USDC_BSC_CONTRACT', '') },
      },
    },
    tron: {
      fullHost: env('TRON_FULL_HOST', 'https://api.trongrid.io'),
      apiKey: env('TRON_API_KEY', ''),
      usdtContract: env('USDT_TRON_CONTRACT', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'),
      contracts: {
        USDT: env('USDT_TRON_CONTRACT', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'),
        USDC: env('USDC_TRON_CONTRACT', ''),
      },
    },
  },
  futures: {
    maxLeverage: envInt('GROM_FUTURES_MAX_LEVERAGE', 100),
    mmr: {
      default: envFloat('GROM_FUTURES_MMR_DEFAULT', 0.005),
    },
    funding: {
      intervalHours: envInt('GROM_FUTURES_FUNDING_INTERVAL_HOURS', 8),
      cap: envFloat('GROM_FUTURES_FUNDING_CAP', 0.0075),
    },
    insurance: {
      contributionPct: envFloat('GROM_FUTURES_INSURANCE_CONTRIBUTION_PCT', 0.05),
    },
  },
  spot: {
    fees: {
      maker: envFloat('GROM_SPOT_MAKER_FEE_BPS', 5),
      taker: envFloat('GROM_SPOT_TAKER_FEE_BPS', 10),
    },
    matching: {
      maxLevelsPerOrder: envInt('GROM_SPOT_MATCH_MAX_LEVELS', 50),
      marketSlippageBps: envFloat('GROM_SPOT_MARKET_SLIPPAGE_BPS', 100),
    },
  },
  sentry: {
    dsn: env('SENTRY_DSN', ''),
    publicDsn: env('SENTRY_PUBLIC_DSN', ''),
    environment: env('SENTRY_ENVIRONMENT', env('NODE_ENV', 'development')),
    release: env('SENTRY_RELEASE', ''),
    tracesSampleRate: envFloat('SENTRY_TRACES_SAMPLE_RATE', 0.1),
    profilesSampleRate: envFloat('SENTRY_PROFILES_SAMPLE_RATE', 0.05),
  },
  admin: {
    ipAllowlist: envList('ADMIN_IP_ALLOWLIST', ''),
    wallets: envList('ADMIN_WALLETS', '0xcfef272536d6e91a4945063d40ac7cba7eb657b5').map((a) => a.toLowerCase()),
    /* CIDRs/IPs of nginx/CF that may set XFF/CF-Connecting-IP. Empty = only loopback trusted for spoofable headers. */
    trustedProxies: envList('GROM_TRUSTED_PROXIES', '127.0.0.1,::1'),
  },
  geo: {
    maxmindDbPath: env('MAXMIND_DB_PATH', ''),
  },
  geoblock: envList('GROM_GEOBLOCK'),
  logLevel: env('GROM_LOG_LEVEL', 'info'),
  /** When true, POST /auth/dev-login issues a JWT (local/staging only — never enable in prod). */
  allowDevLogin: envBool('GROM_ALLOW_DEV_LOGIN', false),
};

export function validateConfig(cfg = config) {
  const issues = [];
  const isProd = cfg.env === 'production';

  if (!cfg.auth.jwtSecret || cfg.auth.jwtSecret === 'insecure-dev-secret-change-me') {
    if (isProd) issues.push('GROM_JWT_SECRET must be set to a strong non-default value');
  }

  if (isProd && !cfg.wallet.walletConnectProjectId) {
    issues.push('GROM_WALLETCONNECT_PROJECT_ID is required');
  }

  if (isProd && (!cfg.wallet.siweDomain || /localhost|127\.0\.0\.1/.test(cfg.wallet.siweDomain))) {
    issues.push('GROM_SIWE_DOMAIN must point to the real application domain');
  }

  if (isProd) {
    if (cfg.allowDevLogin) issues.push('GROM_ALLOW_DEV_LOGIN must be disabled in production');
    if (!cfg.db.password) issues.push('Database password must be configured in production');
    if (!cfg.cors.origin || cfg.cors.origin === '*') issues.push('GROM_CORS_ORIGIN cannot be wildcard in production');
    if (cfg.auth.jwtTtl > 60 * 60 * 24 * 7) issues.push('GROM_JWT_TTL is too long for production');
    const feeAddr = String(process.env.GROM_LIFI_FEE_ADDR || '').trim();
    const feePct = String(process.env.GROM_LIFI_FEE_PCT || '0.002').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(feeAddr)) {
      issues.push('GROM_LIFI_FEE_ADDR must be a valid fee recipient for mandatory 20 bps');
    }
    if (feePct !== '0.002') {
      issues.push('GROM_LIFI_FEE_PCT must be 0.002 (20 bps) in production');
    }
  }

  if (issues.length) {
    const err = new Error('Invalid configuration:\n- ' + issues.join('\n- '));
    err.code = 'GROM_CONFIG_INVALID';
    throw err;
  }
  return true;
}

validateConfig(config);

export default config;
