import axios from 'axios';

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const AXELAR_GMP_URL = 'https://api.axelarscan.io/gmp/searchGMP';
// Squid's verified Axelar router. Unknown deployments need their own verifier.
const SQUID_ROUTER = '0xce16f69375520ab01377ce7b88f5ba8c48f8d666';
const hash = (v) => typeof v === 'string' && TX_HASH_RE.test(v) ? v.toLowerCase() : null;
const address = (v) => typeof v === 'string' && ADDRESS_RE.test(v) ? v.toLowerCase() : null;
const chainId = (v) => ['number', 'string'].includes(typeof v) && Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
const unknown = () => ({ found: false, outcome: 'unknown', bridgeExecuted: false });

function eventHash(event) {
  const values = [event?.transaction?.hash, event?.transactionHash].filter(v => v != null);
  if (!values.length || values.some(v => !hash(v))) return null;
  return values.every(v => hash(v) === hash(values[0])) ? hash(values[0]) : null;
}

/**
 * Axelar confirms GMP execution, not necessarily the final swap: Squid can
 * catch a failed destination multicall and return the bridged token instead.
 * Return bound evidence for a separate destination-receipt check, never a
 * completed swap from GMP status alone.
 */
export function normalizeAxelarGmpStatus(payload, expectedTxHash) {
  const expected = hash(expectedTxHash);
  if (!expected || !Array.isArray(payload?.data)) return unknown();
  const records = payload.data.filter(r => eventHash(r?.call) === expected);
  // A batched source transaction can contain multiple GMP calls. Without an
  // event index in the saved operation, choosing the first could settle another route.
  if (records.length !== 1) return unknown();
  const record = records[0];
  const call = record.call;
  const destination = record.executed;
  const status = String(record.status || '').toLowerCase();
  const simplifiedStatus = String(record.simplified_status || '').toLowerCase();
  const sourceAccount = address(call.transaction?.from);
  const sourceChainId = chainId(call.transaction?.chainId);
  const destinationChainId = chainId(destination?.transaction?.chainId);
  const destinationTxHash = eventHash(destination);
  const payloadHash = hash(call.returnValues?.payloadHash);
  const routerAddress = address(call.returnValues?.destinationContractAddress);
  const bridgeExecuted = status === 'executed' && simplifiedStatus === 'received'
    && !!sourceAccount && !!sourceChainId && !!destinationChainId && sourceChainId !== destinationChainId
    && !!destinationTxHash && !!payloadHash && routerAddress === SQUID_ROUTER
    && address(destination?.transaction?.to) === SQUID_ROUTER
    && hash(destination?.sourceTransactionHash) === expected
    && !Object.entries(record).some(([key, value]) => key.startsWith('is_invalid_') && value === true);

  return {
    found: true,
    outcome: bridgeExecuted ? 'destination_check' : 'unknown',
    bridgeExecuted,
    status,
    simplifiedStatus,
    sourceTxHash: expected,
    sourceAccount,
    sourceChainId,
    destinationChainId,
    destinationTxHash,
    payloadHash,
    routerAddress,
  };
}

/** Fetch one public GMP record from a fixed Axelar host (no caller URL). */
export async function fetchAxelarGmpStatus(txHash, { get = axios.get } = {}) {
  const requestedHash = String(txHash || '').trim();
  if (!TX_HASH_RE.test(requestedHash)) {
    const error = new Error('invalid_transaction_hash');
    error.code = 'INVALID_TX_HASH';
    throw error;
  }
  const response = await get(AXELAR_GMP_URL, {
    params: { txHash: requestedHash },
    timeout: 8000,
    maxRedirects: 0,
    maxContentLength: 1_000_000,
    headers: { Accept: 'application/json', 'User-Agent': 'grom-exchange/1.0' },
    validateStatus: () => true,
  });
  if (response.status < 200 || response.status >= 300) {
    const error = new Error('axelar_status_unavailable');
    error.code = 'UPSTREAM_STATUS';
    throw error;
  }
  return normalizeAxelarGmpStatus(response.data, requestedHash);
}
