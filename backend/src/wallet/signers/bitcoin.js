import crypto from 'node:crypto';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import { ECPairFactory } from 'ecpair';
import config from '../../config/index.js';

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

function dryHash() {
  return crypto.randomBytes(32).toString('hex');
}

export function btcNetwork() {
  return config.signers.bitcoin.network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
}

export function btcToSats(amount) {
  return Math.round(Number(amount) * 100_000_000);
}

export function estimateFeeSats(inputCount, outputCount, feeRateSatVb = config.signers.bitcoin.feeRateSatVb) {
  const virtualBytes = 10 + (inputCount * 68) + (outputCount * 31);
  return Math.ceil(virtualBytes * feeRateSatVb);
}

export function selectUtxos(utxos, targetSats, feeRateSatVb = config.signers.bitcoin.feeRateSatVb) {
  const sorted = [...utxos].sort((a, b) => Number(b.value) - Number(a.value));
  const selected = [];
  let total = 0;
  for (const utxo of sorted) {
    selected.push(utxo);
    total += Number(utxo.value);
    const fee = estimateFeeSats(selected.length, 2, feeRateSatVb);
    if (total >= targetSats + fee) {
      return { selected, total, fee, change: total - targetSats - fee };
    }
  }
  const err = new Error('btc_insufficient_utxos');
  err.status = 400;
  throw err;
}

async function fetchJson(url, fetchImpl = globalThis.fetch) {
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`btc_utxo_api_${res.status}`);
  return res.json();
}

export async function fetchUtxos(address, { api = config.signers.bitcoin.utxoApi, fetchImpl = globalThis.fetch } = {}) {
  return fetchJson(`${api.replace(/\/$/, '')}/address/${address}/utxo`, fetchImpl);
}

export async function fetchTxStatus(txid, { api = config.signers.bitcoin.esploraApi, fetchImpl = globalThis.fetch } = {}) {
  return fetchJson(`${api.replace(/\/$/, '')}/tx/${txid}/status`, fetchImpl);
}

export async function fetchFeeRate({ api = config.signers.bitcoin.esploraApi, fetchImpl = globalThis.fetch } = {}) {
  const estimates = await fetchJson(`${api.replace(/\/$/, '')}/fee-estimates`, fetchImpl);
  return Number(estimates[String(config.signers.bitcoin.feeBlockTarget)] || estimates['6'] || config.signers.bitcoin.feeRateSatVb);
}

export async function fetchTxHex(txid, { api = config.signers.bitcoin.esploraApi, fetchImpl = globalThis.fetch } = {}) {
  const res = await fetchImpl(`${api.replace(/\/$/, '')}/tx/${txid}/hex`);
  if (!res.ok) throw new Error(`btc_tx_api_${res.status}`);
  return res.text();
}

export async function broadcastTx(hex, { api = config.signers.bitcoin.utxoApi, fetchImpl = globalThis.fetch } = {}) {
  const res = await fetchImpl(`${api.replace(/\/$/, '')}/tx`, { method: 'POST', body: hex });
  if (!res.ok) throw new Error(`btc_broadcast_${res.status}`);
  return res.text();
}

export function keyPairFromWif(wif) {
  if (!wif) throw new Error('btc_private_key_missing');
  return ECPair.fromWIF(wif, btcNetwork());
}

export function paymentFromKeyPair(keyPair) {
  return bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: btcNetwork() });
}

export function validateBitcoinAddress(address) {
  try {
    bitcoin.address.toOutputScript(address, btcNetwork());
    return true;
  } catch {
    const err = new Error('invalid_bitcoin_address');
    err.status = 400;
    throw err;
  }
}

export async function buildSignedPsbt({ to, amount, changeAddress, utxos, txHexById = null, keyPair, feeRateSatVb }) {
  validateBitcoinAddress(to);
  const targetSats = btcToSats(amount);
  const { selected, total, fee, change } = selectUtxos(utxos, targetSats, feeRateSatVb);
  const psbt = new bitcoin.Psbt({ network: btcNetwork() });
  const payment = paymentFromKeyPair(keyPair);
  if (!payment.output) throw new Error('btc_payment_script_missing');
  for (const utxo of selected) {
    const input = {
      hash: utxo.txid,
      index: utxo.vout,
      sequence: 0xfffffffd,
      witnessUtxo: {
        script: utxo.script ? Buffer.from(utxo.script, 'hex') : payment.output,
        value: BigInt(utxo.value),
      },
    };
    if (txHexById?.[utxo.txid]) input.nonWitnessUtxo = Buffer.from(txHexById[utxo.txid], 'hex');
    psbt.addInput(input);
  }
  psbt.addOutput({ address: to, value: BigInt(targetSats) });
  if (change > config.signers.bitcoin.dustSats) {
    psbt.addOutput({ address: changeAddress, value: BigInt(change) });
  }
  for (let i = 0; i < selected.length; i += 1) psbt.signInput(i, keyPair);
  psbt.finalizeAllInputs();
  return { hex: psbt.extractTransaction().toHex(), fee, change, inputCount: selected.length, total };
}

export async function signAndBroadcastBitcoin({ to, amount, hotWallet, dryRun = config.signers.dryRun, fetchImpl = globalThis.fetch }) {
  if (dryRun) return { txHash: dryHash(), nonce: 0, dryRun: true, hotWallet: hotWallet?.address || null };
  validateBitcoinAddress(to);
  const keyPair = keyPairFromWif(config.signers.bitcoin.wif || config.signers.bitcoin.privateKey);
  const changeAddress = hotWallet?.address || config.signers.bitcoin.address || paymentFromKeyPair(keyPair).address;
  if (!changeAddress) throw new Error('btc_change_address_missing');
  validateBitcoinAddress(changeAddress);
  const utxos = await fetchUtxos(changeAddress, { fetchImpl });
  const feeRate = await fetchFeeRate({ fetchImpl });
  const targetSats = btcToSats(amount);
  const selected = selectUtxos(utxos, targetSats, feeRate).selected;
  const signed = await buildSignedPsbt({
    to,
    amount,
    changeAddress,
    utxos: selected,
    txHexById: null,
    keyPair,
    feeRateSatVb: feeRate,
  });
  const txHash = await broadcastTx(signed.hex, { fetchImpl });
  return { txHash, nonce: 0, fee: signed.fee, hotWallet: changeAddress };
}

export async function getBitcoinConfirmations({ txHash, fetchImpl = globalThis.fetch } = {}) {
  if (config.signers.dryRun) return config.signers.confirmations.BTC;
  const status = await fetchTxStatus(txHash, { fetchImpl });
  if (!status?.confirmed) return 0;
  const tip = await fetchJson(`${config.signers.bitcoin.esploraApi.replace(/\/$/, '')}/blocks/tip/height`, fetchImpl);
  return Math.max(Number(tip) - Number(status.block_height) + 1, 0);
}
