/** True when a prediction event has no expiry or its expiry is still ahead. */
export function isCurrentPmEnd(endDate, now = Date.now()) {
  if (endDate == null || String(endDate).trim() === '') return true;
  const endMs = new Date(endDate).getTime();
  return Number.isFinite(endMs) && endMs > now;
}
