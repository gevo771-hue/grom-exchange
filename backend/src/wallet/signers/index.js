import { signAndBroadcastEvm, getEvmConfirmations } from './evm.js';
import { signAndBroadcastTron, getTronConfirmations } from './tron.js';
import { signAndBroadcastBitcoin, getBitcoinConfirmations } from './bitcoin.js';
import { signAndBroadcastBinance } from './binance.js';
import config from '../../config/index.js';

const EVM_NETWORKS = new Set(['ETH', 'ARB', 'MATIC', 'BASE', 'BSC']);

export async function signAndBroadcastWithdrawal(input) {
  if (config.binance.useAsHotWallet) return signAndBroadcastBinance(input);
  const network = String(input.network || '').toUpperCase();
  if (EVM_NETWORKS.has(network)) return signAndBroadcastEvm({ ...input, network });
  if (network === 'TRON' || network === 'TRC20' || network === 'TRC-20') return signAndBroadcastTron(input);
  if (network === 'BTC' || network === 'BITCOIN') return signAndBroadcastBitcoin(input);
  throw new Error(`unsupported_signer_network:${input.network}`);
}

export async function getWithdrawalConfirmations({ network, txHash }) {
  const normalized = String(network || '').toUpperCase();
  if (EVM_NETWORKS.has(normalized)) return getEvmConfirmations({ network: normalized, txHash });
  if (normalized === 'TRON' || normalized === 'TRC20' || normalized === 'TRC-20') return getTronConfirmations({ txHash });
  if (normalized === 'BTC' || normalized === 'BITCOIN') return getBitcoinConfirmations({ txHash });
  throw new Error(`unsupported_confirmation_network:${network}`);
}
