#!/usr/bin/env node
/**
 * Point cleanup for legacy Instant Swap quote keys (pre-v2).
 * Does NOT FLUSH Redis. Only deletes keys matching `*:ocquote:*` that
 * are NOT under `ocquote:v2:`.
 *
 * Usage (on a host with REDIS_URL / app .env):
 *   node scripts/cleanup-legacy-ocquote-cache.mjs --dry-run
 *   node scripts/cleanup-legacy-ocquote-cache.mjs --apply
 */
import 'dotenv/config';
import Redis from 'ioredis';

const APPLY = process.argv.includes('--apply');
const url = process.env.REDIS_URL || process.env.GROM_REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });

const KEEP = 'ocquote:v2:';
const MATCH = '*ocquote:*';

async function main() {
  await redis.connect();
  let cursor = '0';
  const doomed = [];
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', MATCH, 'COUNT', 200);
    cursor = next;
    for (const k of keys) {
      if (!String(k).includes(KEEP)) doomed.push(k);
    }
  } while (cursor !== '0');

  console.log(JSON.stringify({
    match: MATCH,
    keepSubstring: KEEP,
    foundLegacy: doomed.length,
    sample: doomed.slice(0, 20),
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
  }, null, 2));

  if (APPLY && doomed.length) {
    const pipe = redis.pipeline();
    for (const k of doomed) pipe.del(k);
    await pipe.exec();
    console.log('deleted', doomed.length);
  }
  await redis.quit();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
