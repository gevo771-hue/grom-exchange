#!/usr/bin/env node
/**
 * One-shot: sync LiFi grom-exchange DONE transfers → dimension_fills (confirmed)
 * and record the scanned window in dimension_index_coverage.
 *
 * Usage (from backend/):
 *   node src/dimensions/sync-lifi-cli.js --from 2026-08-22 [--to 2026-09-14]
 *
 * --from is REQUIRED. --to defaults to start of current UTC day (last completed
 * day exclusive). Future --to is rejected (no silent truncate).
 *
 * Repair prior future-claiming windows:
 *   node src/dimensions/sync-lifi-cli.js --invalidate-future [--from … --to …]
 */
import 'dotenv/config';
import { syncLifiDimensionFills, assertSyncWindow } from './lifi-sync.js';
import {
  listInvalidFutureCoverage,
  invalidateIndexCoverage,
  maxCoverableToSec,
} from './store.js';
import { pool } from '../db/pool.js';

function argValue(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function toUnixSeconds(raw, label) {
  if (raw == null) return null;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && String(raw).trim() !== '') return Math.floor(asNumber);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    console.error(`❌ invalid --${label}: ${raw}`);
    process.exit(2);
  }
  return Math.floor(d.getTime() / 1000);
}

const nowMs = Date.now();
const fromTimestamp = toUnixSeconds(argValue('from'), 'from');
const toRaw = argValue('to');
const toTimestamp = toRaw != null ? toUnixSeconds(toRaw, 'to') : maxCoverableToSec(nowMs);
const doInvalidate = hasFlag('invalidate-future');

if (!doInvalidate && fromTimestamp == null) {
  console.error('❌ --from is required (ISO date or unix seconds). Example: --from 2026-08-22');
  console.error('   Optional --to defaults to start of current UTC day (completed days only).');
  await pool.end();
  process.exit(2);
}

try {
  if (doInvalidate) {
    const bad = await listInvalidFutureCoverage({ nowMs });
    const backup = bad.map((r) => ({
      id: r.id,
      source: r.source,
      product: r.product,
      chain_id: r.chain_id,
      covered_from: r.covered_from,
      covered_to: r.covered_to,
      evidence: r.evidence,
    }));
    const invalidated = [];
    for (const row of bad) {
      const out = await invalidateIndexCoverage({
        source: row.source,
        product: row.product,
        chainId: row.chain_id,
        coveredFrom: row.covered_from,
        coveredTo: row.covered_to,
        reason: 'covered_to_beyond_completed_utc_day',
        evidence: { priorStatus: 'ok', backupAt: new Date().toISOString() },
      });
      invalidated.push(...out);
    }
    console.log(JSON.stringify({
      ok: true,
      action: 'invalidate-future',
      now: new Date(nowMs).toISOString(),
      maxCoverableTo: new Date(maxCoverableToSec(nowMs) * 1000).toISOString(),
      found: bad.length,
      invalidated: invalidated.length,
      backup,
    }, null, 2));
  }

  if (fromTimestamp != null) {
    assertSyncWindow({ fromTimestamp, toTimestamp, nowMs });
    const result = await syncLifiDimensionFills({ fromTimestamp, toTimestamp, nowMs });
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  }
} catch (err) {
  console.error(JSON.stringify({
    ok: false,
    error: err.message,
    code: err.code || null,
    details: err.details || null,
    results: err.results || undefined,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await pool.end();
}
