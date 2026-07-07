import { createHash } from 'node:crypto';
import { query } from '../db/pool.js';

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function inviteCode(userId) {
  const hash = createHash('sha256').update(`grom-invite:${userId}`).digest();
  let code = '';
  for (let i = 0; i < 6; i++) code += INVITE_ALPHABET[hash[i] % INVITE_ALPHABET.length];
  return `GROM-${code}`;
}

export function normalizeReferralCode(raw) {
  if (!raw) return null;
  const code = String(raw).trim().toUpperCase().replace(/^GROM-?/, '');
  return /^[A-Z2-9]{4,8}$/.test(code) ? code : null;
}

export async function attachReferralCode(userId, rawCode) {
  const code = normalizeReferralCode(rawCode);
  if (!code) return false;
  const { rowCount } = await query(
    `UPDATE user_settings
        SET preferences = jsonb_set(COALESCE(preferences, '{}'::jsonb), '{referred_by}', to_jsonb($2::text), true),
            updated_at = NOW()
      WHERE user_id = $1
        AND NOT (COALESCE(preferences, '{}'::jsonb) ? 'referred_by')`,
    [userId, code]
  );
  return rowCount > 0;
}
