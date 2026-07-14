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
        max: Number(process.env.GROM_DB_POOL_MAX) || 50,
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
    max: Number(process.env.GROM_DB_POOL_MAX) || 50,
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
  auth: {
    jwtSecret: env('GROM_JWT_SECRET', env('JWT_SECRET', 'insecure-dev-secret-change-me')),
    jwtTtl: envInt('GROM_JWT_TTL', 86400),
  },
  cors: { origin: env('GROM_CORS_ORIGIN', env('NEXT_PUBLIC_APP_URL', '*')) },
  binary: {
    minStake:    envFloat('GROM_BO_MIN_STAKE', 1),
    maxStake:    envFloat('GROM_BO_MAX_STAKE', 10000),
    payout:      envFloat('GROM_BO_PAYOUT_RATIO', 0.92),
    durations:   envList('GROM_BO_ROUND_DURATIONS', '30,60,300,900').map(Number),
    cooldownMs:  envInt('GROM_BO_COOLDOWN_MS', 500),
    demoBalance: envFloat('GROM_BO_DEMO_BALANCE', 10000),
  },
  liquidity: {
    binance: {
      apiKey: env('GROM_BINANCE_API_KEY'),
      apiSecret: env('GROM_BINANCE_API_SECRET'),
      wsUrl: env('GROM_BINANCE_WS_URL', 'wss://stream.binance.com:9443/ws'),
    },
    kraken: {
      apiKey: env('GROM_KRAKEN_API_KEY'),
      apiSecret: env('GROM_KRAKEN_API_SECRET'),
      wsUrl: env('GROM_KRAKEN_WS_URL', 'wss://ws.kraken.com/v2'),
    },
    coinbase: {
      apiKey: env('GROM_COINBASE_API_KEY'),
      apiSecret: env('GROM_COINBASE_API_SECRET'),
      wsUrl: env('GROM_COINBASE_WS_URL', 'wss://ws-feed.exchange.coinbase.com'),
    },
    oneinchKey: env('GROM_1INCH_API_KEY'),
    odosUrl: env('GROM_ODOS_API_URL', 'https://api.odos.xyz'),
    hummingbot: {
      apiUrl: env('GROM_HUMMINGBOT_API_URL', 'http://hummingbot:15888'),
      apiKey: env('GROM_HUMMINGBOT_API_KEY'),
    },
  },
  wallet: {
    walletConnectProjectId: env('GROM_WALLETCONNECT_PROJECT_ID', ''),
    supportedChains: envList('GROM_SUPPORTED_CHAINS', '1,137,56,42161,8453').map(Number),
    siweDomain: env('GROM_SIWE_DOMAIN', 'localhost:5273'),
    siweStatement: env('GROM_SIWE_STATEMENT', 'Sign in to GROM Finance Hub'),
    withdrawOtpTtlMin: envInt('GROM_WITHDRAW_OTP_TTL_MIN', 10),
    withdrawDailyLimitUsdt: envFloat('GROM_WITHDRAW_DAILY_LIMIT_USDT', 25000),
    withdrawManualApprovalUsdt: envFloat('GROM_WITHDRAW_MANUAL_APPROVAL_USDT', 10000),
    withdrawAddressCooldownHours: envInt('GROM_WITHDRAW_ADDRESS_COOLDOWN_HOURS', 24),
    queuePollMs: envInt('GROM_WITHDRAW_QUEUE_POLL_MS', 30000),
    hotWalletMaxBalance: {
      USDT: envFloat('GROM_HOT_MAX_USDT', 100000),
      USDC: envFloat('GROM_HOT_MAX_USDC', 100000),
      ETH: envFloat('GROM_HOT_MAX_ETH', 250),
      BTC: envFloat('GROM_HOT_MAX_BTC', 25),
    },
    coldAddresses: {
      USDT: env('GROM_COLD_ADDRESS_USDT', 'cold-vault-usdt'),
      USDC: env('GROM_COLD_ADDRESS_USDC', 'cold-vault-usdc'),
      ETH: env('GROM_COLD_ADDRESS_ETH', 'cold-vault-eth'),
      BTC: env('GROM_COLD_ADDRESS_BTC', 'cold-vault-btc'),
    },
    sweepPollMs: envInt('GROM_SWEEP_POLL_MS', 600000),
    // Welcome-credit seed (~$7.8k of BTC/ETH/USDT/SOL) used for early demos.
    // Default-OFF in prod — must be explicitly enabled via GROM_WELCOME_SEED=true
    // for dev/staging. Showing seeded balances to real users is a launch blocker.
    welcomeSeed: envBool('GROM_WELCOME_SEED', false),
  },
  swap: {
    // 'paper' → use Binance public ticker price + debit/credit user postgres
    //           balances atomically. No real Binance Convert call.
    // 'live'  → proxy to Binance Convert on the master GROM account (legacy).
    // Paper is the default until multi-user Convert accounting is designed —
    // otherwise every user swap drains a shared master balance.
    mode: env('GROM_SWAP_MODE', 'paper'),
    // Basic sanity caps (paper mode). Live mode is bounded by Binance itself.
    minUsd: envInt('GROM_SWAP_MIN_USD', 1),
    maxUsd: envInt('GROM_SWAP_MAX_USD', 10000),
    quoteTtlSec: envInt('GROM_SWAP_QUOTE_TTL', 10),
    feePct: Number(env('GROM_SWAP_FEE_PCT', '0.1')), // 0.10% GROM fee on top of price
  },
  webhooks: {
    secret: env('GROM_WEBHOOK_SECRET', ''),
    moonpaySecret: env('GROM_MOONPAY_WEBHOOK_SECRET', ''),
    transakSecret: env('GROM_TRANSAK_WEBHOOK_SECRET', ''),
  },
  email: {
    from: env('EMAIL_FROM', 'GROM <noreply@grom.exchange>'),
    adminTo: env('ADMIN_EMAIL', env('EMAIL_ADMIN_TO', 'admin@grom.exchange')),
    domain: env('EMAIL_DOMAIN', 'grom.exchange'),
    dryRun: envBool('EMAIL_DRY_RUN', true),
    sendgrid: {
      apiKey: env('SENDGRID_API_KEY', ''),
      baseUrl: env('SENDGRID_API_URL', 'https://api.sendgrid.com/v3/mail/send'),
    },
  },
  signers: {
    dryRun: envBool('SIGNERS_DRY_RUN', true),
    evm: {
      privateKey: env('HOT_WALLET_EVM_KEY', ''),
      kmsKeyId: env('HOT_WALLET_EVM_KMS_KEY_ID', ''),
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
      privateKey: env('TRON_HOT_WALLET_KEY', env('HOT_WALLET_TRON_KEY', '')),
      kmsKeyId: env('HOT_WALLET_TRON_KMS_KEY_ID', ''),
      usdtContract: env('USDT_TRON_CONTRACT', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'),
      contracts: {
        USDT: env('USDT_TRON_CONTRACT', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'),
        USDC: env('USDC_TRON_CONTRACT', ''),
      },
    },
    bitcoin: {
      utxoApi: env('ESPLORA_API', env('BTC_UTXO_API', 'https://blockstream.info/api')),
      esploraApi: env('ESPLORA_API', env('BTC_UTXO_API', 'https://blockstream.info/api')),
      privateKey: env('HOT_WALLET_BTC_KEY', ''),
      wif: env('BTC_HOT_WALLET_WIF', ''),
      address: env('BTC_HOT_WALLET_ADDRESS', ''),
      kmsKeyId: env('HOT_WALLET_BTC_KMS_KEY_ID', ''),
      network: env('BTC_NETWORK', 'bitcoin'),
      feeBlockTarget: envInt('BTC_FEE_BLOCK_TARGET', 6),
      feeRateSatVb: envFloat('BTC_FEE_RATE_SAT_VB', 15),
      dustSats: envInt('BTC_DUST_SATS', 546),
    },
    confirmations: {
      ETH: envInt('CONFIRMATIONS_ETH', 12),
      ARB: envInt('CONFIRMATIONS_ARB', 12),
      MATIC: envInt('CONFIRMATIONS_MATIC', 32),
      BASE: envInt('CONFIRMATIONS_BASE', 12),
      BSC: envInt('CONFIRMATIONS_BSC', 15),
      TRON: envInt('CONFIRMATIONS_TRON', 19),
      BTC: envInt('CONFIRMATIONS_BTC', 6),
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
  mm: {
    enabled: envBool('MM_ENABLED', false),
    userId: env('MM_USER_ID', '00000000-0000-4000-8000-0000000000aa'),
    dryRun: envBool('MM_DRY_RUN', true),
    refreshMs: envInt('MM_REFRESH_MS', 3000),
    requoteThresholdBps: envFloat('MM_REQUOTE_THRESHOLD_BPS', 5),
    maxTotalDrawdownUsdt: envFloat('MM_MAX_TOTAL_DRAWDOWN_USDT', 500),
    binance: {
      apiKey: env('BINANCE_API_KEY', ''),
      apiSecret: env('BINANCE_API_SECRET', ''),
      useTestnet: envBool('BINANCE_USE_TESTNET', true),
      wsUrl: env('BINANCE_WS_URL', 'wss://stream.binance.com:9443/ws'),
      restUrl: env('BINANCE_REST_URL', envBool('BINANCE_USE_TESTNET', true) ? 'https://testnet.binance.vision' : 'https://api.binance.com'),
    },
    pairs: [
      { pair: 'BTC/USDT', binanceSymbol: 'BTCUSDT', spreadBps: 20, layerOffsetsBps: [10, 40], sizeBase: 0.01, layerSizeMultipliers: [1, 2.5], maxPositionBase: 0.5 },
      { pair: 'ETH/USDT', binanceSymbol: 'ETHUSDT', spreadBps: 25, layerOffsetsBps: [10, 40], sizeBase: 0.1, layerSizeMultipliers: [1, 2.5], maxPositionBase: 5 },
      { pair: 'SOL/USDT', binanceSymbol: 'SOLUSDT', spreadBps: 30, layerOffsetsBps: [15, 50], sizeBase: 2, layerSizeMultipliers: [1, 2], maxPositionBase: 100 },
    ],
  },
  binance: {
    useAsHotWallet: envBool('BINANCE_HOT_WALLET', false),
    apiKey: env('BINANCE_API_KEY', ''),
    apiSecret: env('BINANCE_API_SECRET', ''),
    useTestnet: envBool('BINANCE_USE_TESTNET', true),
    dryRun: envBool('BINANCE_DRY_RUN', true),
    depositReconcileMs: envInt('BINANCE_DEPOSIT_RECONCILE_MS', 30_000),
    confirmWatcherMs: envInt('BINANCE_CONFIRM_WATCHER_MS', 30_000),
    maxWithdrawalUsd: envFloat('BINANCE_MAX_WITHDRAWAL_USD', 5000),
    alertOnFailures: envInt('BINANCE_ALERT_ON_FAILURES', 3),
    apiWeightPerMinute: envInt('BINANCE_API_WEIGHT_PER_MINUTE', 1200),
    baseUrl: env('BINANCE_REST_URL', envBool('BINANCE_USE_TESTNET', true) ? 'https://testnet.binance.vision' : 'https://api.binance.com'),
  },
  sentry: {
    dsn: env('SENTRY_DSN', ''),
    publicDsn: env('SENTRY_PUBLIC_DSN', ''),
    environment: env('SENTRY_ENVIRONMENT', env('NODE_ENV', 'development')),
    release: env('SENTRY_RELEASE', ''),
    tracesSampleRate: envFloat('SENTRY_TRACES_SAMPLE_RATE', 0.1),
    profilesSampleRate: envFloat('SENTRY_PROFILES_SAMPLE_RATE', 0.05),
  },
  kyc: {
    provider: env('KYC_PROVIDER', 'sumsub'),
    sumsub: {
      apiKey: env('SUMSUB_API_KEY', ''),
      apiSecret: env('SUMSUB_SECRET', ''),
      webhookSecret: env('SUMSUB_WEBHOOK_SECRET', ''),
      baseUrl: env('SUMSUB_BASE_URL', 'https://test-api.sumsub.com'),
      levelName: env('SUMSUB_LEVEL', 'basic-kyc-level'),
    },
  },
  onramp: {
    moonpay: {
      publicKey: env('MOONPAY_PUBLIC_KEY', ''),
      secretKey: env('MOONPAY_SECRET_KEY', ''),
      webhookSecret: env('MOONPAY_WEBHOOK_SECRET', ''),
      environment: env('MOONPAY_ENV', 'sandbox'),
      baseUrl: env('MOONPAY_BASE_URL', env('MOONPAY_ENV', 'sandbox') === 'production' ? 'https://buy.moonpay.com' : 'https://buy-sandbox.moonpay.com'),
    },
  },
  admin: {
    ipAllowlist: envList('ADMIN_IP_ALLOWLIST', ''),
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
