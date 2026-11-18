/**
 * One GeckoTerminal budget for the whole server.
 *
 * The free API allows about 30 calls a minute per IP. Trending on DEXs, the NEW strip's DEX scan and
 * token logos each paced themselves, but together they went over the limit; every 429 made Trending
 * pause and whole networks showed «Fresh data unavailable» for minutes (owner, 18.11: BASE, POL, OP,
 * AVAX, LINEA empty on the phone).
 *
 * - Trending (what people look at) may use the whole budget.
 * - Background jobs (NEW scan, token logos) start a call only while the last minute had fewer than
 *   `backgroundPerMin` calls — Trending always keeps room.
 * - After a 429 nobody calls until the provider's Retry-After (at least a minute) has passed.
 */
export function createGtGate({
  now = Date.now,
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  perMin = 25,
  backgroundPerMin = 10,
  gapMs = 2100,
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
