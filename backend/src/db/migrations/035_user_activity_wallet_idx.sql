-- «Tokens this wallet bought on GROM» (/api/activity/wallet-tokens) reads by wallet.
CREATE INDEX IF NOT EXISTS idx_user_activity_wallet ON user_activity (wallet_address, created_at DESC);
