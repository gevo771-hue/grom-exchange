/**
 * One GeckoTerminal budget for the whole server.
 *
 * The free API allows about 10 calls a minute per IP (measured 18.11: five quick calls pass, the sixth
 * is a 429 with Retry-After 0; one call every 6.1 s — 12 of 12 pass). Trending on DEXs, the NEW
 * strip's DEX scan and token logos each paced themselves at 2–2.5 s, so together they ran far over the
 * limit; every 429 made Trending pause, and the networks at the end of the list (OP, AVAX, LINEA,
 * Robinhood) stayed «Fresh data unavailable» (owner, 18.11).
 *
 * - Trending (what people look at) may use the whole budget.
 * - Background jobs (NEW scan, token logos) start a call only while the last minute had fewer than
 *   `backgroundPerMin` calls — Trending always keeps room.
 * - After a 429 nobody calls until the provider's Retry-After (at least a minute) has passed.
 */
export function createGtGate({
  now = Date.now,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  perMin = 9,
  backgroundPerMin = 4,
  gapMs = 6000,
} = {}) {
  const starts = []; // call start times within the last minute
  let next = 0;
  let coolUntil = 0;
  const prune = (t) => { while (starts.length && t - starts[0] >= 60_000) starts.shift(); };

  /** Resolves true when the call may start now (it is counted), false if that would take longer than maxWaitMs. */
  async function slot({ background = false, maxWaitMs = 60_000 } = {}) {
    const began = now();
    for (;;) {
      const t = now();
      prune(t);
      const cap = background ? backgroundPerMin : perMin;
      let wait = 0;
      if (t < coolUntil) wait = coolUntil - t;
      else if (t < next) wait = next - t;
      else if (starts.length >= cap) wait = starts[0] + 60_000 - t;
      if (wait <= 0) {
        starts.push(t);
        next = t + gapMs;
        return true;
      }
      if (t - began + wait > maxWaitMs) return false;
      await pause(Math.min(wait, 5_000)); // look again: another caller may have taken the slot
    }
  }

  function note429(error) {
    const t = now();
    const header = error?.response?.headers?.['retry-after'];
    const seconds = Number(header);
    const delay = Number.isFinite(seconds) ? seconds * 1000 : (Date.parse(header) - t) || 0;
    coolUntil = Math.max(coolUntil, t + Math.max(60_000, delay));
    return coolUntil;
  }

  return {
    slot,
    note429,
    cooling: () => now() < coolUntil,
    coolUntil: () => coolUntil,
    usedLastMinute: () => { prune(now()); return starts.length; },
  };
}

/** Shared by every GeckoTerminal caller in this process. */
export const gtGate = createGtGate();
