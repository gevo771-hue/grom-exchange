-- 031: Drop dead custodial wallet_action_challenges if still present.
-- 027 created it; 029 should have dropped it. Idempotent cleanup for upgrade paths
-- where 029 was skipped or partially applied. No active runtime references.

DROP TABLE IF EXISTS wallet_action_challenges CASCADE;

-- Explicit: do NOT create notifications_outbox / symbols / alerts —
-- those legacy email/AML/CEX admin surfaces are removed from runtime (RR5-02/07).
