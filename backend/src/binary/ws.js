/**
 * Lightweight WebSocket broadcaster for binary options + price feed.
 * Uses native `ws` — no stickiness required because we don't hold user state
 * beyond the connection (auth is via JWT on connect).
 */
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import logger from '../utils/logger.js';

export function createWsBroadcaster(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const channels = new Map();      // channel -> Set<WebSocket>
  const serverListeners = new Map(); // channel -> Set<Function>

  function userChannelOwner(channel) {
    const match = String(channel).match(/^(balances|orders|positions|notifications)\.user\.([a-f0-9-]+)$/i);
    return match ? match[2] : null;
  }

  function canSubscribe(ws, channel) {
    const owner = userChannelOwner(channel);
    if (!owner) return true;
    return Boolean(ws.user?.sub && String(ws.user.sub) === String(owner));
  }

  function authenticateToken(token) {
    if (!token) return null;
    return jwt.verify(token, config.auth.jwtSecret);
  }

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.user = null;
    ws.subs = new Set();

    // Optional auth via ?token=
    try {
      const url = new URL(req.url, 'http://x');
      const token = url.searchParams.get('token');
      if (token) ws.user = authenticateToken(token);
    } catch (err) {
      logger.debug({ err: err.message }, 'ws auth skipped');
    }

    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type === 'auth' && msg.token) {
        try {
          ws.user = authenticateToken(msg.token);
          ws.send(JSON.stringify({ type: 'authenticated', userId: ws.user?.sub || null }));
        } catch {
          ws.send(JSON.stringify({ type: 'auth_error', error: 'invalid_token' }));
        }
      } else if (msg.type === 'subscribe' && Array.isArray(msg.channels)) {
        const accepted = [];
        const rejected = [];
        for (const ch of msg.channels) {
          if (!canSubscribe(ws, ch)) {
            rejected.push(ch);
            continue;
          }
          if (!channels.has(ch)) channels.set(ch, new Set());
          channels.get(ch).add(ws);
          ws.subs.add(ch);
          accepted.push(ch);
        }
        ws.send(JSON.stringify({ type: 'subscribed', channels: accepted, rejected }));
      } else if (msg.type === 'unsubscribe' && Array.isArray(msg.channels)) {
        for (const ch of msg.channels) {
          channels.get(ch)?.delete(ws);
          ws.subs.delete(ch);
        }
      }
    });

    ws.on('close', () => {
      for (const ch of ws.subs) channels.get(ch)?.delete(ws);
    });
  });

  const ping = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      try { ws.ping(); } catch {}
    }
  }, 30_000);
  wss.on('close', () => clearInterval(ping));

  return {
    broadcast(channel, data) {
      const payload = JSON.stringify({ type: 'event', channel, data });
      const set = channels.get(channel);
      if (set) {
        for (const ws of set) {
          if (ws.readyState === 1) try { ws.send(payload); } catch {}
        }
      }
      const listeners = serverListeners.get(channel);
      if (listeners) {
        for (const fn of listeners) {
          try { fn({ channel, data }); } catch (err) {
            logger.warn({ err: err.message, channel }, 'server ws listener failed');
          }
        }
      }
    },
    subscribeServer(channel, fn) {
      if (!serverListeners.has(channel)) serverListeners.set(channel, new Set());
      serverListeners.get(channel).add(fn);
      return () => serverListeners.get(channel)?.delete(fn);
    },
    close() { wss.close(); },
  };
}

export default createWsBroadcaster;
