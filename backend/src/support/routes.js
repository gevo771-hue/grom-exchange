/**
 * Support tickets — minimal but real persistence.
 *   GET   /api/support/tickets       — current user tickets
 *   POST  /api/support/tickets       — create ticket
 *   POST  /api/support/escalate      — escalate withdrawal / urgent issue
 */
import express from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';

const ticketSchema = z.object({
  category: z.enum(['trading', 'wallet', 'kyc', 'security', 'other']).default('other'),
  subject:  z.string().min(2).max(200),
  body:     z.string().max(5000).optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  metadata: z.record(z.any()).optional(),
}).strict();

const escalateSchema = z.object({
  reason:   z.string().min(2).max(500),
  withdraw_id: z.string().uuid().optional(),
}).strict();

export function createSupportRouter({ requireAuth }) {
  const r = express.Router();

  r.get('/tickets', requireAuth, async (req, res, next) => {
    try {
      const { rows } = await query(
        `SELECT id, category, subject, status, priority, created_at, updated_at
           FROM support_tickets
           WHERE user_id=$1
           ORDER BY created_at DESC
           LIMIT 50`,
        [req.user.sub]
      );
      res.json({ tickets: rows });
    } catch (err) { next(err); }
  });

  r.post('/tickets', requireAuth, async (req, res, next) => {
    try {
      const input = ticketSchema.parse(req.body || {});
      const { rows } = await query(
        `INSERT INTO support_tickets (user_id, category, subject, body, priority, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        RETURNING id, category, subject, status, priority, created_at`,
        [req.user.sub, input.category, input.subject, input.body || null, input.priority, JSON.stringify(input.metadata || {})]
      );
      // Outbox notify
      await query(
        `INSERT INTO notifications_outbox (user_id, channel, template, payload)
         VALUES ($1, 'email', 'ticket_created', jsonb_build_object('ticket_id', $2))`,
        [req.user.sub, rows[0].id]
      );
      res.status(201).json({ ticket: rows[0] });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  r.post('/escalate', requireAuth, async (req, res, next) => {
    try {
      const input = escalateSchema.parse(req.body || {});
      const { rows } = await query(
        `INSERT INTO support_tickets
           (user_id, category, subject, body, priority, metadata)
         VALUES
           ($1, 'wallet', 'Withdrawal escalation', $2, 'high',
            jsonb_build_object('withdraw_id', $3))
         RETURNING id, category, subject, status, priority, created_at`,
        [req.user.sub, input.reason, input.withdraw_id || null]
      );
      await query(
        `INSERT INTO notifications_outbox (user_id, channel, template, payload)
         VALUES ($1, 'email', 'escalation_received', jsonb_build_object('ticket_id', $2))`,
        [req.user.sub, rows[0].id]
      );
      res.status(201).json({ ticket: rows[0] });
    } catch (err) {
      if (err.name === 'ZodError') return res.status(400).json({ error: 'validation', details: err.issues });
      next(err);
    }
  });

  return r;
}

export default createSupportRouter;
