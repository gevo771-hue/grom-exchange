/** WalletConnect/Reown project ids are public client identifiers, never secrets. */
export function walletConnectProjectIdForClient(value) {
  const id = String(value ?? '').trim();
  return /^[a-f0-9]{32}$/i.test(id) ? id : null;
}
