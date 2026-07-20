/**
 * Shared Redis client(s) for quote cache + WS cross-worker pub/sub.
 * commandTimeout keeps a bad Redis from blocking swap quotes.
 */
import Redis from 'ioredis';
import config from '../config/index.js';
import logger from './logger.js';

function redisOpts() {
  return {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: true,
    connectTimeout: 2000,
    commandTimeout: 1500,
    lazyConnect: false,
  };
}

function makeClient() {
  const { url, host, port } = config.redis || {};
  const opts = redisOpts();
  return url ? new Redis(url, opts) : new Redis({ host: host || 'redis', port: port || 6379, ...opts });
}

let client;
let pub;
let sub;

export function getRedis() {
  if (!client) {
    client = makeClient();
    client.on('error', (err) => logger.warn({ err: err.message }, 'redis client error'));
  }
  return client;
}

export async function getRedisPubSub() {
  if (!pub) {
    pub = makeClient();
    sub = makeClient();
    pub.on('error', (err) => logger.warn({ err: err.message }, 'redis pub error'));
    sub.on('error', (err) => logger.warn({ err: err.message }, 'redis sub error'));
    await Promise.all([pub.ping(), sub.ping()]);
  }
  return { pub, sub };
}

export async function closeRedis() {
  const closes = [client, pub, sub].filter(Boolean).map((r) => r.quit().catch(() => {}));
  client = pub = sub = undefined;
  await Promise.all(closes);
}

export default getRedis;
