/**
 * Normalize LI.FI /status payloads into honest Instant Swap outcomes (F03/F21).
 * DONE alone is not success; REFUNDED / PARTIAL / unknown substatus must not be green success.
 */

export const SWAP_OUTCOMES = Object.freeze({
  PENDING: 'pending',
  SOURCE_CONFIRMED: 'source_confirmed',
  BRIDGING: 'bridging',
  COMPLETED: 'completed',
  PARTIAL: 'partial',
  REFUND_PENDING: 'refund_pending',
  REFUNDED: 'refunded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown',
});

/**
 * @param {{ status?: string, substatus?: string, substatusMessage?: string, receiving?: object, sending?: object }} payload
 * @returns {{ outcome: string, success: boolean, message: string, assetHint: string|null }}
 */
export function normalizeLifiBridgeStatus(payload = {}) {
  const status = String(payload.status || '').toUpperCase();
  const sub = String(payload.substatus || '').toUpperCase();
  const msg = String(payload.substatusMessage || payload.message || '').slice(0, 240);
  const recvSym = payload.receiving?.token?.symbol
    || payload.receiving?.token?.name
    || null;

  if (!status) {
    return { outcome: SWAP_OUTCOMES.UNKNOWN, success: false, message: msg || 'empty status', assetHint: recvSym };
  }

  if (status === 'NOT_FOUND' || status === 'INVALID') {
    return { outcome: SWAP_OUTCOMES.UNKNOWN, success: false, message: msg || status, assetHint: recvSym };
  }

  if (status === 'PENDING' || status === 'ACTION_REQUIRED') {
    const bridging = /BRIDGE|WAIT|RECEIVE|CONFIRM/i.test(sub) || /BRIDGE/i.test(msg);
    return {
      outcome: bridging ? SWAP_OUTCOMES.BRIDGING : SWAP_OUTCOMES.PENDING,
      success: false,
      message: msg || sub || status,
      assetHint: recvSym,
    };
  }

  if (status === 'FAILED') {
    if (/REFUND/i.test(sub) || /REFUND/i.test(msg)) {
      return { outcome: SWAP_OUTCOMES.REFUND_PENDING, success: false, message: msg || sub, assetHint: recvSym };
    }
    return { outcome: SWAP_OUTCOMES.FAILED, success: false, message: msg || sub || 'FAILED', assetHint: recvSym };
  }

  if (status === 'DONE') {
    if (sub === 'REFUNDED' || /REFUND/i.test(sub)) {
      return {
        outcome: SWAP_OUTCOMES.REFUNDED,
        success: false,
        message: msg || 'Refunded to source — not destination delivery',
        assetHint: recvSym,
      };
    }
    if (sub === 'PARTIAL' || /PARTIAL/i.test(sub)) {
      return {
        outcome: SWAP_OUTCOMES.PARTIAL,
        success: false,
        message: msg || 'Partial fill — output asset/amount may differ from selection',
        assetHint: recvSym,
      };
    }
    if (sub === 'COMPLETED' || sub === '' || sub === 'DONE') {
      // Empty substatus on DONE is ambiguous — treat as completed only when receiving present
      if (!sub && !payload.receiving) {
        return {
          outcome: SWAP_OUTCOMES.UNKNOWN,
          success: false,
          message: 'DONE without substatus/receiving — not auto-success',
          assetHint: null,
        };
      }
      return {
        outcome: SWAP_OUTCOMES.COMPLETED,
        success: true,
        message: msg || 'Destination delivery confirmed',
        assetHint: recvSym,
      };
    }
    // Unknown DONE substatus — do not auto-success
    return {
      outcome: SWAP_OUTCOMES.UNKNOWN,
      success: false,
      message: msg || `DONE/${sub || 'unknown'} — manual review`,
      assetHint: recvSym,
    };
  }

  return { outcome: SWAP_OUTCOMES.UNKNOWN, success: false, message: msg || status, assetHint: recvSym };
}

export default { normalizeLifiBridgeStatus, SWAP_OUTCOMES };
