/**
 * WebSocket broadcaster — price feed + authenticated user channels.
 *
 * Cluster-safe: subscription state stays local per worker; broadcasts fan out
 * through Redis pub/sub so a user on worker A receives events published from
 * worker B (order placement, settlement, price ticks from the leader).
 */
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { getRedisPubSub } from '../utils/redis.js';

const REDIS_WS_CHANNEL = `${config.redis.namespace}ws:broadcast`;
const MAX_CHANNELS_PER_SOCKET = 32;
const MAX_MESSAGE_BYTES = 4_096;
const PUBLIC_CHANNEL_RE = /^(price:[A-Z0-9/._-]+|markets|ticker)$/;
const USER_CHANNEL_RE = /^(balances|notifications)\.user\.([0-9a-f-]{36})$/i;

/** @returns {{ ok: true, channel: string } | { ok: false, reason: string }} */
export function authorizeWsChannel(channel, user) {
  const ch = String(channel || '');
  if (!ch || ch.length > 128) return { ok: false, reason: 'invalid_channel' };
  if (PUBLIC_CHANNEL_RE.test(ch)) return { ok: true, channel: ch };
  const m = ch.match(USER_CHANNEL_RE);
  if (!m) return { ok: false, reason: 'channel_forbidden' };
  if (!user?.sub) return { ok: false, reason: 'auth_required' };
  if (String(user.sub).toLowerCase() !== m[2].toLowerCase()) {
    return { ok: false, reason: 'channel_forbidden' };
  }
  return { ok: true, channel: ch };
}

export async function createWsBroadcaster(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const channels = new Map();      // channel -> Set<WebSocket>
  let pub = null;
  let sub = null;

  function localSend(channel, payloadStr) {
    const set = channels.get(channel);
    if (!set) return;
    for (const ws of set) {
      if (ws.readyState === 1) try { ws.send(payloadStr); } catch {}
    }
  }

  function addSub(ws, ch) {
    if (!channels.has(ch)) channels.set(ch, new Set());
    channels.get(ch).add(ws);
    ws.subs.add(ch);
  }

  function removeSub(ws, ch) {
    const set = channels.get(ch);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) channels.delete(ch);
    ws.subs.delete(ch);
  }

  try {
    ({ pub, sub } = await getRedisPubSub());
    await sub.subscribe(REDIS_WS_CHANNEL);
    sub.on('message', (_ch, raw) => {
      try {
        const { channel, payload } = JSON.parse(raw.toString());
        if (channel && payload) localSend(channel, payload);
      } catch (err) {
        logger.debug({ err: err.message }, 'ws redis message parse');
      }
    });
    logger.info('WS broadcaster: Redis pub/sub enabled (cluster-safe)');
  } catch (err) {
    logger.warn({ err: err.message }, 'WS broadcaster: Redis unavailable — local-only mode');
  }

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.user = null;
    ws.subs = new Set();

    try {
      const url = new URL(req.url, 'http://x');
      const token = url.searchParams.get('token');
      if (token) ws.user = jwt.verify(token, config.auth.jwtSecret);
    } catch (err) {
      logger.debug({ err: err.message }, 'ws auth skipped');
    }

    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw) => {
      const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw || ''));
      if (buf.length > MAX_MESSAGE_BYTES) {
        try { ws.send(JSON.stringify({ type: 'error', error: 'message_too_large' })); } catch {}
        try { ws.close(1009, 'message_too_large'); } catch {}
        return;
      }
      const now = Date.now();
      ws._msgWindow = ws._msgWindow || { t: now, n: 0 };
      if (now - ws._msgWindow.t > 10_000) { ws._msgWindow = { t: now, n: 0 }; }
      ws._msgWindow.n += 1;
      if (ws._msgWindow.n > 60) {
        try { ws.close(1008, 'rate_limited'); } catch {}
        return;
      }
      let msg;
      try { msg = JSON.parse(buf.toString()); } catch { return; }
      if (msg.type === 'subscribe' && Array.isArray(msg.channels)) {
        const accepted = [];
        const rejected = [];
        const slice = msg.channels.slice(0, MAX_CHANNELS_PER_SOCKET);
        for (const ch of slice) {
          if (ws.subs.size >= MAX_CHANNELS_PER_SOCKET) {
            rejected.push({ channel: ch, reason: 'too_many_channels' });
            continue;
          }
          const auth = authorizeWsChannel(ch, ws.user);
          if (!auth.ok) {
            rejected.push({ channel: ch, reason: auth.reason });
            continue;
          }
          addSub(ws, auth.channel);
          accepted.push(auth.channel);
        }
        try {
          ws.send(JSON.stringify({ type: 'subscribed', channels: accepted, rejected }));
        } catch {}
      } else if (msg.type === 'unsubscribe' && Array.isArray(msg.channels)) {
        for (const ch of msg.channels) removeSub(ws, String(ch));
      }
    });

    ws.on('close', () => {
      for (const ch of [...ws.subs]) removeSub(ws, ch);
    });
  });

  const ping = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) {
        try { ws.terminate(); } catch {}
        continue;
      }
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }, 30_000);
  wss.on('close', () => clearInterval(ping));

  return {
    broadcast(channel, data) {
      const payload = JSON.stringify({ type: 'event', channel, data });
      if (pub) {
        pub.publish(REDIS_WS_CHANNEL, JSON.stringify({ channel, payload }))
          .catch((err) => logger.warn({ err: err.message, channel }, 'ws redis publish failed'));
      } else {
        localSend(channel, payload);
      }
    },
    close() {
      clearInterval(ping);
      wss.close();
    },
  };
}

export default createWsBroadcaster;
