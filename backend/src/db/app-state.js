/**
 * Key → JSON snapshots in Postgres (`app_state`, migration 036) for services whose in-memory state
 * must survive a restart. Reads and writes never throw to the caller: a missing table (first start,
 * before `npm run migrate`) or a database hiccup just means «nothing saved».
 */
export function createAppState({ dbQuery } = {}) {
  const run = async (text, params) => {
    const q = dbQuery || (await import('./pool.js')).query;
    return q(text, params);
  };
  return {
    async get(key) {
      try {
        const { rows } = await run('SELECT value FROM app_state WHERE key = $1', [String(key)]);
        return rows && rows[0] ? rows[0].value : null;
      } catch (_) {
        return null;
      }
    },
    async set(key, value) {
      try {
        await run(
          `INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [String(key), JSON.stringify(value)],
        );
        return true;
      } catch (_) {
        return false;
      }
    },
  };
}

let _shared = null;
export function appState() {
  if (!_shared) _shared = createAppState();
  return _shared;
}
