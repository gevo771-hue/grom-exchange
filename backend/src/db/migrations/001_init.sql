-- GROM Exchange — initial schema
-- Fully isolated from Granium. Database name: grom.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================== USERS ==================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address  TEXT NOT NULL UNIQUE,      -- 0x... lowercase
    chain_id        INTEGER NOT NULL,
    ens_name        TEXT,
    country_code    CHAR(2),                    -- ISO 3166-1 alpha-2, from geo-IP at signup
    kyc_status      TEXT NOT NULL DEFAULT 'none' CHECK (kyc_status IN ('none','pending','verified','rejected')),
    risk_level      TEXT NOT NULL DEFAULT 'standard' CHECK (risk_level IN ('standard','elevated','blocked')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users (wallet_address);

-- ================== SIWE NONCE STORE ==================
-- Sign-In with Ethereum nonces. Short-lived, prevent replay.
CREATE TABLE IF NOT EXISTS siwe_nonces (
    nonce       TEXT PRIMARY KEY,
    issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consumed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_siwe_unused ON siwe_nonces (issued_at) WHERE consumed_at IS NULL;

-- ================== BALANCES ==================
-- Demo + live. Non-custodial means "live" balance reflects on-chain deposits via bridge contract;
-- Binary options are settled against a segregated ledger (see bo_ledger).
CREATE TABLE IF NOT EXISTS balances (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset        TEXT NOT NULL,        -- 'USDT','USDC','ETH','BTC'...
    mode         TEXT NOT NULL CHECK (mode IN ('live','demo')),
    amount       NUMERIC(38,18) NOT NULL DEFAULT 0,
    locked       NUMERIC(38,18) NOT NULL DEFAULT 0,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, asset, mode),
    CHECK (amount >= 0 AND locked >= 0)
);

-- ================== BINARY OPTIONS ==================

CREATE TABLE IF NOT EXISTS bo_rounds (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset          TEXT NOT NULL,               -- 'BTC/USDT'
    duration_sec   INTEGER NOT NULL,            -- 30 | 60 | 300 | 900
    open_at        TIMESTAMPTZ NOT NULL,
    close_at       TIMESTAMPTZ NOT NULL,        -- strike time (cut-off for new bets)
    expiry_at      TIMESTAMPTZ NOT NULL,        -- settlement time
    strike_price   NUMERIC(24,8),               -- filled at close_at
    expiry_price   NUMERIC(24,8),               -- filled at expiry_at
    status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked','settling','settled','cancelled')),
    settled_at     TIMESTAMPTZ,
    total_up       NUMERIC(24,8) NOT NULL DEFAULT 0,
    total_down     NUMERIC(24,8) NOT NULL DEFAULT 0,
    payout_ratio   NUMERIC(6,4)   NOT NULL DEFAULT 0.92
);
CREATE INDEX IF NOT EXISTS idx_bo_rounds_asset_open  ON bo_rounds (asset, status, close_at);
CREATE INDEX IF NOT EXISTS idx_bo_rounds_expiry      ON bo_rounds (expiry_at) WHERE status IN ('open','locked');

CREATE TABLE IF NOT EXISTS bo_positions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id     UUID NOT NULL REFERENCES bo_rounds(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id),
    direction    TEXT NOT NULL CHECK (direction IN ('up','down')),
    stake        NUMERIC(24,8) NOT NULL CHECK (stake > 0),
    asset        TEXT NOT NULL,                 -- stake currency (USDT)
    mode         TEXT NOT NULL CHECK (mode IN ('live','demo')),
    payout       NUMERIC(24,8),                 -- net P/L, filled on settlement
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost','refunded','cancelled')),
    placed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at   TIMESTAMPTZ,
    client_ip    INET
);
CREATE INDEX IF NOT EXISTS idx_bo_positions_user   ON bo_positions (user_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bo_positions_round  ON bo_positions (round_id, status);

-- Segregated ledger (append-only audit trail). Source of truth for binary P/L.
CREATE TABLE IF NOT EXISTS bo_ledger (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES users(id),
    position_id  UUID REFERENCES bo_positions(id),
    kind         TEXT NOT NULL CHECK (kind IN ('stake_lock','stake_refund','payout_win','payout_loss','adjustment')),
    amount       NUMERIC(24,8) NOT NULL,       -- signed
    asset        TEXT NOT NULL,
    mode         TEXT NOT NULL CHECK (mode IN ('live','demo')),
    balance_after NUMERIC(38,18) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bo_ledger_user_time ON bo_ledger (user_id, created_at DESC);

-- ================== SPOT ORDERS (minimal scaffold) ==================
CREATE TABLE IF NOT EXISTS spot_orders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id),
    pair         TEXT NOT NULL,
    side         TEXT NOT NULL CHECK (side IN ('buy','sell')),
    type         TEXT NOT NULL CHECK (type IN ('market','limit','stop')),
    price        NUMERIC(24,8),
    amount       NUMERIC(24,8) NOT NULL,
    filled       NUMERIC(24,8) NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'pending',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spot_orders_user ON spot_orders (user_id, created_at DESC);

-- ================== AUDIT / RATE LIMIT ==================
CREATE TABLE IF NOT EXISTS rate_limit_events (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID,
    key          TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_key ON rate_limit_events (user_id, key, created_at DESC);
