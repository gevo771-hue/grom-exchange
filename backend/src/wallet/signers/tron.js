import crypto from 'node:crypto';
import { TronWeb } from 'tronweb';
import config from '../../config/index.js';

function dryHash() {
  return crypto.randomBytes(32).toString('hex');
}

export function getTronWeb() {
  if (!config.signers.tron.privateKey) throw new Error('tron_private_key_missing');
  return new TronWeb({
    fullHost: config.signers.tron.fullHost,
    headers: config.signers.tron.apiKey ? { 'TRON-PRO-API-KEY': config.signers.tron.apiKey } : {},
    privateKey: config.signers.tron.privateKey,
  });
}

export function toTronBaseUnits(amount, decimals = 6) {
  return BigInt(Math.round(Number(amount) * (10 ** decimals))).toString();
}

export async function signAndBroadcastTrc20({ asset, to, amount, hotWallet, dryRun = config.signers.dryRun, tronWeb = null }) {
  if (dryRun) return { txHash: dryHash(), nonce: 0, dryRun: true, hotWallet: hotWallet?.address || null };
  const client = tronWeb || getTronWeb();
  if (!client.isAddress(to)) {
    const err = new Error('invalid_tron_address');
    err.status = 400;
    throw err;
  }
  if (asset === 'TRX') {
    const txid = await withTimeout(
      client.trx.sendTransaction(to, client.toSun(Number(amount))),
      15_000,
      'tron_send_timeout'
    );
    return { txHash: txid?.txid || txid, nonce: null, hotWallet: hotWallet?.address || client.defaultAddress?.base58 || null };
  }
  const contractAddress = config.signers.tron.contracts?.[asset];
  if (!contractAddress) throw new Error(`tron_contract_missing:${asset}`);
  const contract = await client.contract().at(contractAddress);
  const txid = await withTimeout(
    contract.transfer(to, toTronBaseUnits(amount, 6)).send({
      feeLimit: 100_000_000,
      callValue: 0,
      shouldPollResponse: false,
    }),
    15_000,
    'tron_send_timeout'
  );
  return { txHash: txid, nonce: null, hotWallet: hotWallet?.address || client.defaultAddress?.base58 || null };
}

export async function signAndBroadcastTron(input) {
  return signAndBroadcastTrc20(input);
}

export async function getTronConfirmations({ txHash, tronWeb = null } = {}) {
  if (config.signers.dryRun) return config.signers.confirmations.TRON;
  const client = tronWeb || getTronWeb();
  const info = await client.trx.getTransactionInfo(txHash);
  if (!info || !info.blockNumber) return 0;
  if (info.receipt?.result && info.receipt.result !== 'SUCCESS') {
    const err = new Error(`tron_tx_${info.receipt.result.toLowerCase()}`);
    err.reverted = true;
    throw err;
  }
  const latest = await client.trx.getCurrentBlock();
  const latestNumber = Number(latest?.block_header?.raw_data?.number || 0);
  return Math.max(latestNumber - Number(info.blockNumber) + 1, 0);
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
}
