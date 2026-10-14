/** Describe available account evidence without identifying a person or hiding records. */
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
