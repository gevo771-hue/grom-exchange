/** Describe available account evidence without identifying a person. */
export function userRecordEvidence(row) {
  const address = String(row.wallet_address || '').toLowerCase();
  if (address === 'market-maker') return { record_kind: 'service', record_label: 'Служебная запись' };
  // Historical activity is evidence in the log, not an identity or live-session proof.
  if (row.siwe_recorded_at) return { record_kind: 'siwe_recorded', record_label: 'Есть запись SIWE-входа' };
  if (/^0x0{36}[a-f0-9]{4}$/.test(address) || /^0x([a-f0-9])\1{39}$/.test(address)) {
    return { record_kind: 'placeholder', record_label: 'Шаблонный адрес · SIWE не записан' };
  }
  return { record_kind: 'unverified', record_label: 'SIWE-вход не записан' };
}

/** Admin presentation filter only; retained audit records and account access are unchanged.
 * SQL expressions are internal constants, never request input. A recorded signed login
 * protects an unusual but usable address from being hidden by its appearance alone.
 */
export function visibleWalletSql(address = 'wallet_address') {
  const normalized = `lower(COALESCE(${address}, ''))`;
  return `(${normalized} <> 'market-maker' AND (
    NOT (${normalized} ~ '^0x0{36}[a-f0-9]{4}$'
      OR (${normalized} ~ '^0x[a-f0-9]{40}$' AND substring(${normalized} from 3) = repeat(substring(${normalized} from 3 for 1), 40)))
    OR EXISTS (SELECT 1 FROM user_activity wallet_evidence
      WHERE lower(wallet_evidence.wallet_address) = ${normalized}
        AND wallet_evidence.product = 'auth' AND wallet_evidence.action IN ('register','login')
        AND wallet_evidence.status = 'done' AND wallet_evidence.detail->>'method' IN ('siwe','device_siwe'))
  ))`;
}
