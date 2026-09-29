/** Idempotency middleware stub — stores keys when idempotency_keys table exists. */
export default function idempotencyMiddleware(_routeKey) {
  return (_req, _res, next) => next();
}
