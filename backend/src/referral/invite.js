import { randomBytes } from 'node:crypto';
import { query } from '../db/pool.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^(?:[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}|[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6})$/;

/** Generate a 50-bit, non-sequential invite code. */
export function generateReferralCode() {
  const bytes = randomBytes(10);
  let code = '';
  for (const byte of bytes) code += ALPHABET[byte & 31];
  return code;
}

/** Six-character codes are accepted only when a registered legacy alias exists. */
export function normalizeReferralCode(raw) {
  const code = String(raw ?? '').trim().toUpperCase().replace(/^GROM-/, '');
  return CODE_RE.test(code) ? code : null;
}

export function normalizeReferralWallet(raw) {
  if (typeof raw !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(raw)) return null;
  return raw.toLowerCase();
}

/** The previous browser algorithm; aliases are never supplied by a caller. */
export function legacyReferralCode(wallet) {
  const key = 'grom-invite:' + wallet.toLowerCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  let x = h >>> 0, code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[x % ALPHABET.length];
    x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
  }
  return code;
}

export async function registerLegacyReferralAlias(wallet, db = query) {
  // Only addresses with a verified account can acquire a legacy alias. Public
  // registration cannot claim somebody else's old code or create an account.
  await db(`UPDATE wallet_referral_links SET legacy_code=$2
    WHERE wallet_address=$1 AND legacy_code IS NULL
      AND EXISTS (SELECT 1 FROM users WHERE wallet_address=$1)
      AND NOT EXISTS (SELECT 1 FROM wallet_referral_links WHERE legacy_code=$2)`,
  [wallet, legacyReferralCode(wallet)]).catch(err => { if (err?.code !== '23505') throw err; });
}

export async function ensurePublicReferralCode(rawWallet, db = query) {
  const wallet = normalizeReferralWallet(rawWallet);
  if (!wallet) throw new TypeError('Invalid referral wallet');
  const existing = await db('SELECT code FROM wallet_referral_links WHERE wallet_address=$1', [wallet]);
  if (existing.rows[0]) {
    await registerLegacyReferralAlias(wallet, db);
    return existing.rows[0].code;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateReferralCode();
    try {
      const assigned = await db(
        `INSERT INTO wallet_referral_links (wallet_address, code) VALUES ($1,$2)
         ON CONFLICT (wallet_address) DO UPDATE SET wallet_address=EXCLUDED.wallet_address
         RETURNING code`, [wallet, candidate]
      );
      await registerLegacyReferralAlias(wallet, db);
      return assigned.rows[0].code;
    } catch (err) {
      if (err?.code !== '23505' || attempt === 4) throw err;
    }
  }
  throw new Error('Could not allocate a referral code');
}

/** Bind a verified account to its already-issued public identity. */
export async function ensureReferralCode(userId) {
  if (!userId) throw new TypeError('userId is required');
  const { rows } = await query('SELECT wallet_address FROM users WHERE id=$1', [userId]);
  if (!rows[0]) throw new Error('Referral account not found');
  const wallet = rows[0].wallet_address;
  const code = await ensurePublicReferralCode(wallet);
  await query('UPDATE users SET referral_code=$2 WHERE id=$1 AND referral_code IS NULL', [userId, code]);
  // Preserve old links for verified accounts. A collision never reassigns an
  // alias owned by another wallet; canonical 50-bit links remain available.
  return code;
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
        SET referred_by=referrer.id, referred_by_wallet=link.wallet_address, referred_at=NOW()
       FROM wallet_referral_links AS link
       LEFT JOIN users AS referrer ON referrer.wallet_address=link.wallet_address
      WHERE invitee.id=$1
        AND invitee.referred_by IS NULL
        AND invitee.referred_by_wallet IS NULL
        AND (link.code=$2 OR link.legacy_code=$2)
        AND link.wallet_address <> invitee.wallet_address`,
    [userId, referralCode]
  );
  return rowCount === 1;
}
