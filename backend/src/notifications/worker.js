import { query, withTx } from '../db/pool.js';
import logger from '../utils/logger.js';
import { renderEmailTemplate } from './template-renderer.js';
import { sendEmail } from './sendgrid.js';

const DEFAULT_BACKOFF_SECONDS = [5, 30, 300, 3600];

export function nextNotificationDelaySeconds(attempts, backoff = DEFAULT_BACKOFF_SECONDS) {
  return backoff[Math.min(Math.max(attempts - 1, 0), backoff.length - 1)];
}

export function createConsoleNotificationProvider() {
  return {
    async email(message) {
      logger.info({ notification: message }, 'mock email notification sent');
    },
    async sms(message) {
      logger.info({ notification: message }, 'mock sms notification sent');
    },
  };
}

async function resolveRecipient(userId) {
  const { rows } = await query(
    `SELECT u.wallet_address, s.email
       FROM users u
       LEFT JOIN user_settings s ON s.user_id = u.id
      WHERE u.id=$1
      LIMIT 1`,
    [userId]
  );
  return rows[0]?.email || null;
}

export async function sendNotification(provider, row) {
  const channel = String(row.channel || '').toLowerCase();
  if (channel === 'sms' && provider?.sms) return provider.sms(row);
  if (channel === 'email' && provider?.email) return provider.email(row);
  if (channel !== 'email') return { ok: false, error: `unsupported_notification_channel:${channel}` };
  const to = await resolveRecipient(row.user_id);
  if (!to) return { ok: false, error: 'user_email_missing' };
  const rendered = await renderEmailTemplate(row.template, {
    ...(row.payload || {}),
    user: { id: row.user_id, email: to },
  });
  return sendEmail({ to, ...rendered });
}

export function startNotificationsWorker({
  provider = null,
  intervalMs = 2_000,
  batchSize = 10,
  wsBroadcaster = null,
} = {}) {
  let stopped = false;
  let running = false;

  async function drainOnce() {
    if (running || stopped) return;
    running = true;
    try {
      const { rows } = await withTx(async (tx) => {
        const selected = await tx.query(
          `SELECT id, user_id, channel, template, payload, attempts
             FROM notifications_outbox
            WHERE status IN ('queued','retry')
              AND attempts < 5
              AND next_attempt_at <= NOW()
            ORDER BY created_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED`,
          [batchSize]
        );
        if (!selected.rows.length) return { rows: [] };
        const ids = selected.rows.map((row) => row.id);
        await tx.query(
          `UPDATE notifications_outbox
              SET status='sending', attempts=attempts + 1
            WHERE id = ANY($1::bigint[])`,
          [ids]
        );
        return { rows: selected.rows };
      });

      for (const row of rows) {
        try {
          const sent = await sendNotification(provider, row);
          if (sent && sent.ok === false) throw new Error(sent.error || 'notification_provider_failed');
          await query(
            `UPDATE notifications_outbox
                SET status='sent',
                    sent_at=NOW(),
                    last_error=NULL,
                    provider_message_id=$2,
                    provider_error=NULL
              WHERE id=$1`,
            [row.id, sent?.messageId || null]
          );
          if (wsBroadcaster && row.user_id) {
            wsBroadcaster.broadcast(`notifications.user.${row.user_id}`, {
              id: row.id,
              channel: row.channel,
              template: row.template,
              payload: row.payload,
              status: 'sent',
            });
          }
        } catch (err) {
          const attempts = Number(row.attempts || 0) + 1;
          const nextStatus = attempts >= 5 ? 'dead_letter' : 'retry';
          await query(
            `UPDATE notifications_outbox
                SET status=$2,
                    attempts=$3,
                    last_error=$4,
                    provider_error=$4,
                    next_attempt_at=NOW() + ($5 || ' seconds')::interval
              WHERE id=$1`,
            [row.id, nextStatus, attempts, err.message, nextNotificationDelaySeconds(attempts)]
          );
          logger.warn({
            err: err.message,
            id: row.id,
            attempts,
            retryInSec: nextNotificationDelaySeconds(attempts),
          }, 'notification send failed');
        }
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'notifications worker drain failed');
    } finally {
      running = false;
    }
  }

  const timer = setInterval(drainOnce, intervalMs);
  timer.unref?.();
  drainOnce();

  return {
    drainOnce,
    async stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

export default startNotificationsWorker;
