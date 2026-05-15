import config from '../../config/index.js';
import { query } from '../../db/pool.js';
import { binance } from '../../integrations/binance/client.js';
import { toBinanceNetwork } from '../../integrations/binance/network-map.js';

const USD_ASSETS = new Set(['USDT', 'USDC', 'BUSD', 'USD']);

export async function signAndBroadcastBinance({ asset, network, to, amount, memo, transferId }) {
  const coin = String(asset || '').toUpperCase();
  const mappedNetwork = toBinanceNetwork(network);
  if (!mappedNetwork) throw new Error(`binance_network_unsupported:${network}`);
  if (USD_ASSETS.has(coin) && Number(amount) > config.binance.maxWithdrawalUsd) {
    throw new Error('binance_withdrawal_limit_exceeded');
  }
  if (config.binance.dryRun) {
    return { txHash: 'dryrun', binanceWithdrawId: 'dryrun', nonce: null, dryRun: true };
  }
  const res = await binance.withdraw({
    coin,
    network: mappedNetwork,
    address: to,
    amount: String(amount),
    memo,
  });
  await query(
    `INSERT INTO binance_withdrawal_log (transfer_id, binance_withdraw_id, binance_status, binance_response)
     VALUES ($1, $2, 'pending', $3::jsonb)`,
    [transferId || null, res.id || null, JSON.stringify(res || {})]
  );
  if (transferId && res.id) {
    await query(
      `UPDATE wallet_transfers
          SET binance_withdraw_id=$2, updated_at=NOW()
        WHERE id=$1`,
      [transferId, res.id]
    );
  }
  return { txHash: null, binanceWithdrawId: res.id || null, nonce: null };
}

export default signAndBroadcastBinance;
