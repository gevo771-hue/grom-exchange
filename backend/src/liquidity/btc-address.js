/**
 * Bitcoin address validation: Base58Check (1…/3…) and Bech32/Bech32m (bc1…).
 * Rejects strings that only match loose regexes (audit F11).
 */
import { createHash } from 'node:crypto';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP = Object.create(null);
for (let i = 0; i < B58.length; i++) B58_MAP[B58[i]] = i;

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_MAP = Object.create(null);
for (let i = 0; i < BECH32_CHARSET.length; i++) BECH32_MAP[BECH32_CHARSET[i]] = i;

function sha256(buf) {
  return createHash('sha256').update(buf).digest();
}

function decodeBase58(str) {
  const s = String(str || '');
  if (!s) return null;
  let zeros = 0;
  while (zeros < s.length && s[zeros] === '1') zeros++;
  const size = Math.ceil(((s.length - zeros) * 733) / 1000) + 1;
  const b256 = new Uint8Array(size);
  for (let i = zeros; i < s.length; i++) {
    const c = B58_MAP[s[i]];
    if (c === undefined) return null;
    let carry = c;
    for (let j = size - 1; j >= 0; j--) {
      carry += 58 * b256[j];
      b256[j] = carry & 0xff;
      carry >>= 8;
    }
    if (carry) return null;
  }
  let start = 0;
  while (start < size && b256[start] === 0) start++;
  const out = new Uint8Array(zeros + (size - start));
  out.fill(0, 0, zeros);
  out.set(b256.subarray(start), zeros);
  return out;
}

export function isValidBase58CheckAddress(addr) {
  const decoded = decodeBase58(String(addr || '').trim());
  if (!decoded || decoded.length < 25) return false;
  if (decoded.length !== 25) return false;
  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  const hash = sha256(sha256(payload));
  for (let i = 0; i < 4; i++) {
    if (hash[i] !== checksum[i]) return false;
  }
  const ver = payload[0];
  // mainnet P2PKH (0x00) or P2SH (0x05)
  return ver === 0x00 || ver === 0x05;
}

function bech32Polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp) {
  const ret = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}

function bech32VerifyChecksum(hrp, data, encoding) {
  const constVal = encoding === 'bech32m' ? 0x2bc830a3 : 1;
  return bech32Polymod(bech32HrpExpand(hrp).concat(data)) === constVal;
}

export function decodeBech32Address(addr) {
  const s = String(addr || '').trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (s !== lower && s !== s.toUpperCase()) return null; // mixed case invalid
  const pos = lower.lastIndexOf('1');
  if (pos < 1 || pos + 7 > lower.length) return null;
  const hrp = lower.slice(0, pos);
  if (hrp !== 'bc' && hrp !== 'tb') return null;
  const data = [];
  for (let i = pos + 1; i < lower.length; i++) {
    const v = BECH32_MAP[lower[i]];
    if (v === undefined) return null;
    data.push(v);
  }
  const values = data.slice(0, -6);
  const checksumOkBech32 = bech32VerifyChecksum(hrp, data, 'bech32');
  const checksumOkBech32m = bech32VerifyChecksum(hrp, data, 'bech32m');
  if (!checksumOkBech32 && !checksumOkBech32m) return null;
  if (!values.length) return null;
  const witVer = values[0];
  if (witVer < 0 || witVer > 16) return null;
  // Convert 5-bit groups to bytes (program)
  const prog5 = values.slice(1);
  let acc = 0;
  let bits = 0;
  const prog = [];
  for (const v of prog5) {
    acc = (acc << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      prog.push((acc >> bits) & 0xff);
    }
  }
  if (bits >= 5 || ((acc << (8 - bits)) & 0xff)) {
    // leftover bits that aren't padding zeros → invalid
    if (bits > 0 && ((acc << (8 - bits)) & 0xff) !== 0) return null;
  }
  if (prog.length < 2 || prog.length > 40) return null;
  if (witVer === 0) {
    if (!checksumOkBech32) return null;
    if (prog.length !== 20 && prog.length !== 32) return null;
  } else {
    if (!checksumOkBech32m) return null;
  }
  return { hrp, witnessVersion: witVer, program: Uint8Array.from(prog), encoding: checksumOkBech32m ? 'bech32m' : 'bech32' };
}

/**
 * @param {string} addr
 * @param {{ network?: 'mainnet'|'testnet'|'any' }} [opts]
 */
export function isValidBitcoinAddress(addr, opts = {}) {
  const network = opts.network || 'mainnet';
  const s = String(addr || '').trim();
  if (!s || s.length < 14 || s.length > 90) return false;
  if (/^(1|3)/.test(s)) {
    if (network === 'testnet') return false;
    return isValidBase58CheckAddress(s);
  }
  if (/^(bc1|tb1)/i.test(s)) {
    const d = decodeBech32Address(s);
    if (!d) return false;
    if (network === 'mainnet' && d.hrp !== 'bc') return false;
    if (network === 'testnet' && d.hrp !== 'tb') return false;
    return true;
  }
  return false;
}

/** Extract THOR/LI.FI deposit memo — never use slippage or numeric placeholders. */
export function extractThorDepositMemo(quote) {
  if (!quote || typeof quote !== 'object') return null;
  const candidates = [
    quote.transactionRequest?.data,
    quote.transactionRequest?.memo,
    quote.memo,
    quote.toolDetails?.memo,
  ];
  for (const step of quote.includedSteps || []) {
    if (step?.toolDetails?.memo) candidates.push(step.toolDetails.memo);
    if (step?.estimate?.memo) candidates.push(step.estimate.memo);
    // Explicitly skip action.slippage (audit F11 false memo source)
  }
  for (const c of candidates) {
    if (c == null) continue;
    const s = String(c).trim();
    if (!s || s === '0x' || s === '0X') continue;
    if (/^0x[0-9a-fA-F]+$/.test(s) && s.length <= 10) continue;
    // Numeric-only / tiny floats are not memos (e.g. slippage 0.02)
    if (/^\d+(\.\d+)?$/.test(s)) continue;
    // THOR memos often look like: =:ETH.USDT:0x… or SWAP:…
    if (s.length >= 8) return s;
  }
  return null;
}

export default { isValidBitcoinAddress, isValidBase58CheckAddress, decodeBech32Address, extractThorDepositMemo };
