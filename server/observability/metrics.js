// In-memory performance metrics. Rolling windows only — resets on restart.
// Kept intentionally dependency-free; exposed via /api/observability/metrics.

const MAX_SAMPLES_PER_ROUTE = 500;
const MAX_RECENT_REQUESTS = 300;
const MAX_SLOW_QUERIES = 200;

const startedAt = Date.now();

const routeStats = new Map(); // "GET /api/journals/:id" -> stats
const recentRequests = []; // ring buffer of the latest requests
const slowQueries = []; // ring buffer of slow DB queries
const dbTotals = { count: 0, totalMs: 0, errors: 0 };

// Collapse ids/uuids so /api/journals/42 and /api/journals/57 share one bucket.
export const normalizeRoutePath = (path) =>
  String(path || '')
    .split('?')[0]
    .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:uuid');

const percentile = (sorted, p) => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
};

export const recordRequest = ({ method, path, statusCode, durationMs, requestId, userId }) => {
  const routeKey = `${method} ${normalizeRoutePath(path)}`;

  let stats = routeStats.get(routeKey);
  if (!stats) {
    stats = { count: 0, errors4xx: 0, errors5xx: 0, totalMs: 0, maxMs: 0, samples: [] };
    routeStats.set(routeKey, stats);
  }

  stats.count += 1;
  stats.totalMs += durationMs;
  stats.maxMs = Math.max(stats.maxMs, durationMs);
  if (statusCode >= 500) stats.errors5xx += 1;
  else if (statusCode >= 400) stats.errors4xx += 1;

  stats.samples.push(durationMs);
  if (stats.samples.length > MAX_SAMPLES_PER_ROUTE) stats.samples.shift();

  recentRequests.push({
    time: new Date().toISOString(),
    method,
    path,
    statusCode,
    durationMs,
    requestId,
    userId: userId || null,
  });
  if (recentRequests.length > MAX_RECENT_REQUESTS) recentRequests.shift();
};

export const recordQuery = ({ durationMs, error }) => {
  dbTotals.count += 1;
  dbTotals.totalMs += durationMs;
  if (error) dbTotals.errors += 1;
};

export const recordSlowQuery = ({ sql, durationMs, requestId }) => {
  slowQueries.push({
    time: new Date().toISOString(),
    durationMs,
    requestId: requestId || null,
    sql: String(sql).replace(/\s+/g, ' ').trim().slice(0, 500),
  });
  if (slowQueries.length > MAX_SLOW_QUERIES) slowQueries.shift();
};

export const getMetricsSnapshot = () => {
  const routes = [...routeStats.entries()]
    .map(([route, s]) => {
      const sorted = [...s.samples].sort((a, b) => a - b);
      return {
        route,
        count: s.count,
        errors4xx: s.errors4xx,
        errors5xx: s.errors5xx,
        avgMs: Math.round(s.totalMs / s.count),
        p50Ms: percentile(sorted, 50),
        p95Ms: percentile(sorted, 95),
        p99Ms: percentile(sorted, 99),
        maxMs: s.maxMs,
      };
    })
    .sort((a, b) => b.count - a.count);

  const memory = process.memoryUsage();

  return {
    startedAt: new Date(startedAt).toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    process: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      nodeVersion: process.version,
    },
    db: {
      totalQueries: dbTotals.count,
      totalErrors: dbTotals.errors,
      avgMs: dbTotals.count ? Math.round(dbTotals.totalMs / dbTotals.count) : 0,
      slowQueries: [...slowQueries].reverse(),
    },
    routes,
    recentRequests: [...recentRequests].reverse(),
  };
};
