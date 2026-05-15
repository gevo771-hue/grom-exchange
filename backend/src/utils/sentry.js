import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import config from '../config/index.js';

let enabled = false;

function optionalIntegration(factory) {
  try {
    return typeof factory === 'function' ? factory() : null;
  } catch {
    return null;
  }
}

export function initSentry() {
  if (!config.sentry.dsn || enabled) return false;
  const integrations = [
    optionalIntegration(Sentry.expressIntegration),
    optionalIntegration(Sentry.contextLinesIntegration),
    optionalIntegration(Sentry.extraErrorDataIntegration),
    optionalIntegration(nodeProfilingIntegration),
  ].filter(Boolean);

  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    release: config.sentry.release || undefined,
    tracesSampleRate: config.sentry.tracesSampleRate,
    profilesSampleRate: config.sentry.profilesSampleRate,
    integrations,
  });
  Sentry.profiler?.startProfiler?.();
  enabled = true;
  return true;
}

export function sentryRequestMiddleware() {
  return (req, _res, next) => {
    if (enabled) {
      Sentry.setUser(req.user?.sub ? { id: req.user.sub, address: req.user.addr || req.user.address } : null);
      Sentry.setTags({ method: req.method, path: req.path });
    }
    next();
  };
}

export function captureException(err, context = {}) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    const user = context.user || context.req?.user;
    if (user?.sub || user?.id) scope.setUser({ id: user.sub || user.id, address: user.addr || user.address });
    for (const [key, value] of Object.entries(context)) {
      if (key !== 'req' && key !== 'user') scope.setContext(key, value);
    }
    Sentry.captureException(err);
  });
}

export function sentryErrorMiddleware() {
  return (err, req, _res, next) => {
    captureException(err, {
      user: req.user,
      request: {
        method: req.method,
        path: req.path,
        ip: req.ip,
      },
    });
    next(err);
  };
}

export async function closeSentry(timeoutMs = 2000) {
  if (enabled) await Sentry.close(timeoutMs);
}

export default { initSentry, sentryRequestMiddleware, sentryErrorMiddleware, captureException, closeSentry };
