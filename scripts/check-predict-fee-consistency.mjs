#!/usr/bin/env node
/**
 * Ensures predictions fee is a single source of truth:
 * - window.GROM_FEES.predictTaker in index.html
 * - footer i18n uses {pct} (not a hard-coded 0.5%)
 * - openModal / demo settle do not hard-code a divergent rate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = fs.readFileSync(path.join(root, 'frontend/public/index.html'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'frontend/public/grom-i18n-extra.js'), 'utf8');

const issues = [];

const feeMatch = indexHtml.match(/predictTaker:\s*([0-9.]+)/);
if (!feeMatch) issues.push('missing GROM_FEES.predictTaker in index.html');
const rate = feeMatch ? Number(feeMatch[1]) : NaN;
if (!(rate >= 0 && rate < 0.05)) issues.push('predictTaker out of expected range: ' + rate);
const pct = (rate * 100).toFixed(2);

if (/feeRate:\s*0\.003/.test(indexHtml) && !/feeRate:\s*gromPredictFeeRate\(\)/.test(indexHtml)) {
  issues.push('hard-coded feeRate: 0.003 still present — use gromPredictFeeRate()');
}
if (/v\s*\*\s*0\.997/.test(indexHtml)) {
  issues.push('demo settle still uses hard-coded 0.997 — must use (1 - gromPredictFeeRate())');
}
if (/px_foot_predict:.*0\.5%/.test(i18n)) {
  issues.push('i18n px_foot_predict still hard-codes 0.5% — use {pct}');
}
const footHits = [...i18n.matchAll(/px_foot_predict:\s*'([^']*)'/g)];
if (!footHits.length) issues.push('no px_foot_predict strings found');
for (const m of footHits) {
  if (!m[1].includes('{pct}')) issues.push('px_foot_predict missing {pct}: ' + m[1].slice(0, 80));
}
if (!/function gromPredictFeeRate\(/.test(indexHtml)) {
  issues.push('missing gromPredictFeeRate()');
}
if (!/assertPredictFeeConsistency/.test(indexHtml)) {
  issues.push('missing assertPredictFeeConsistency');
}
if (!/gromPredictFootHtml\(/.test(indexHtml)) {
  issues.push('footer not built via gromPredictFootHtml()');
}

if (issues.length) {
  console.error('[check-predict-fee-consistency] FAIL');
  issues.forEach((i) => console.error(' -', i));
  console.error('Expected rate', rate, '→', pct + '%');
  process.exit(1);
}
console.log('[check-predict-fee-consistency] OK · predictTaker=' + rate + ' (' + pct + '%) · footer uses {pct}');
