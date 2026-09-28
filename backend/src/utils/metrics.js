import client from 'prom-client';

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry, prefix: 'grom_' });

export const metrics = {
  priceFeedLatencyMs: new client.Histogram({
    name: 'grom_price_feed_latency_ms',
    help: 'Time between exchange tick timestamp and server receipt',
    labelNames: ['source'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500],
    registers: [registry],
  }),
  priceFeedFailover: new client.Counter({
    name: 'grom_price_feed_failover_total',
    help: 'Number of failover switches between price sources',
    labelNames: ['from', 'to'],
    registers: [registry],
  }),
  httpRequests: new client.Counter({
    name: 'grom_http_requests_total',
    help: 'HTTP requests received',
    labelNames: ['method', 'route', 'status'],
    registers: [registry],
  }),
};

export default metrics;
