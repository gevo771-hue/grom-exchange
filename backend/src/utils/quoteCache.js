/**
 * Short-lived Redis cache for DEX swap quotes.
 * Under stress, uncached quotes fan out to 1inch/Odos and hit 429.
 */
import { createHash } from 'node:crypto';
import config from '../config/index.js';
import logger from './logger.js';
import { getRedis } from './redis.js';

const TTL = () => config.quoteCache?.ttlSec ?? 8;
const NS = () => config.redis?.namespace || 'grom:';

export function quoteCacheKey({ chainId, src, dst, amount }) {
  const raw = `${chainId}:${src}:${dst}:${amount}`;
  const hash = createHash('sha256').update(raw).digest('hex').slice(0, 24);
  return `${NS()}quote:${hash}`;
}

export async function cachedQuote(key, fetcher) {
  try {
    const redis = getRedis();
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit);
  } catch (err) {
    logger.debug({ err: err.message, key }, 'quote cache read miss (redis)');
  }

  const fresh = await fetcher();

  try {
    const redis = getRedis();
    await redis.setex(key, TTL(), JSON.stringify(fresh));
  } catch (err) {
    logger.debug({ err: err.message, key }, 'quote cache write skip');
  }

  return fresh;
}

export default cachedQuote;
