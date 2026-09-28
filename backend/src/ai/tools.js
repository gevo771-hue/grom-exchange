/**
 * Read-only tools for the coach (no shell, no arbitrary URL fetch).
 */
import { CAPABILITIES } from './capabilities.js';

/** Canonical predict fee — keep in sync with frontend window.GROM_FEES.predictTaker */
export const FEE_CONFIG = {
  predictTaker: 0.003,
  predictTakerPct: 0.3,
  xstocks: 0.002,
  xstocksPct: 0.2,
  source: 'GROM_FEES',
};

export function getFeeSnapshot() {
  return {
    status: 'ok',
    source: FEE_CONFIG.source,
    asOf: new Date().toISOString(),
    predictTaker: FEE_CONFIG.predictTaker,
    predictTakerLabel: `${FEE_CONFIG.predictTakerPct}%`,
    xstocks: FEE_CONFIG.xstocks,
    xstocksLabel: `${FEE_CONFIG.xstocksPct}%`,
    note: 'Swap/routing fees vary by venue; always show live quote fees before sign.',
  };
}

export function getProductAvailability(productId) {
  const p = CAPABILITIES.products[productId];
  if (!p) {
    return {
      status: 'unknown',
      productId,
      available: false,
      asOf: new Date().toISOString(),
      source: 'capabilities',
    };
  }
  return {
    status: 'ok',
    productId: p.id,
    available: !!p.available,
    actions: p.actions,
    rails: p.rails,
    notes: p.notes,
    asOf: new Date().toISOString(),
    source: 'capabilities',
  };
}

export function redactSnapshotForModel(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return { balances: [], generatedAt: new Date().toISOString() };
  const balances = Array.isArray(snapshot.balances)
    ? snapshot.balances.map((b) => ({
      asset: b.asset,
      mode: b.mode === 'demo' || b.mode === 'internal' ? b.mode : (b.mode || 'ledger'),
      amount: b.mode === 'demo' || b.mode === 'internal' ? null : b.amount,
      locked: b.mode === 'demo' || b.mode === 'internal' ? null : b.locked,
      amountStatus: (b.mode === 'demo' || b.mode === 'internal')
        ? 'not_onchain_demo_or_internal'
        : (Number.isFinite(Number(b.amount)) ? 'ledger' : 'unknown'),
    }))
    : [];
  return {
    mode: snapshot.mode || (balances.length ? 'authenticated_ledger' : 'guest'),
    walletHint: snapshot.walletHint || null,
    balances,
    recentTransfers: [],
    generatedAt: snapshot.generatedAt || new Date().toISOString(),
    warning: 'Demo/internal amounts are omitted. Unknown ≠ 0. Ledger ≠ on-chain wallet.',
  };
}

export default { getFeeSnapshot, getProductAvailability, redactSnapshotForModel, FEE_CONFIG };
