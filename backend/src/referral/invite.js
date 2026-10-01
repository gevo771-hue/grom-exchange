import { randomBytes } from 'node:crypto';
import { query } from '../db/pool.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/;

/** Generate a 50-bit, non-sequential invite code. */
export function generateReferralCode() {
  const bytes = randomBytes(10);
  let code = '';
  for (const byte of bytes) code += ALPHABET[byte & 31];
  return code;
}

/** Accept either the URL form (10 chars) or display form (GROM- + 10 chars). */
export function normalizeReferralCode(raw) {
  const code = String(raw ?? '').trim().toUpperCase().replace(/^GROM-/, '');
  return CODE_RE.test(code) ? code : null;
}

/** Lazily allocate a stable public code for an account. */
export async function ensureReferralCode(userId) {
  if (!userId) throw new TypeError('userId is required');

  const existing = await query('SELECT referral_code FROM users WHERE id=$1', [userId]);
  if (!existing.rows[0]) throw new Error('Referral account not found');
  if (existing.rows[0].referral_code) return existing.rows[0].referral_code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateReferralCode();
    try {
      const assigned = await query(
        `UPDATE users SET referral_code=$2
          WHERE id=$1 AND referral_code IS NULL
          RETURNING referral_code`,
        [userId, candidate]
      );
      if (assigned.rows[0]?.referral_code) return assigned.rows[0].referral_code;

      // A parallel login may have assigned a code after the initial read.
      const current = await query('SELECT referral_code FROM users WHERE id=$1', [userId]);
      if (!current.rows[0]) throw new Error('Referral account not found');
      if (current.rows[0].referral_code) return current.rows[0].referral_code;
    } catch (err) {
      if (err?.code !== '23505' || attempt === 4) throw err;
    }
  }
  throw new Error('Could not allocate a referral code');
}

/**
 * Attach only an un-attributed account. The atomic UPDATE makes attribution
 * immutable after first successful signup and rejects self-referrals.
 */
export async function attachReferralCode(userId, rawReferralCode) {
  const referralCode = normalizeReferralCode(rawReferralCode);
  if (!userId || !referralCode) return false;
  const { rowCount } = await query(
    `UPDATE users AS invitee
        SET referred_by=referrer.id, referred_at=NOW()
       FROM users AS referrer
      WHERE invitee.id=$1
        AND invitee.referred_by IS NULL
        AND referrer.referral_code=$2
        AND referrer.id <> invitee.id`,
    [userId, referralCode]
  );
  return rowCount === 1;
}
