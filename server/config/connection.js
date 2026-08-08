import mysql from 'mysql2/promise';

import logger from '../observability/logger.js';
import { recordQuery, recordSlowQuery } from '../observability/metrics.js';
import { getRequestId } from '../observability/requestContext.js';

const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS || 200);
const INSTRUMENTED = Symbol('observability-instrumented');

const extractSql = (arg) => (typeof arg === 'string' ? arg : arg?.sql || '');

// Times every query/execute call, feeds the metrics store, and logs slow or
// failing queries with the current request id for tracing.
const instrumentQueryable = (target) => {
  if (target[INSTRUMENTED]) return target;
  target[INSTRUMENTED] = true;

  for (const method of ['query', 'execute']) {
    const original = target[method].bind(target);

    target[method] = async (...args) => {
      const startedAt = process.hrtime.bigint();
      const sql = extractSql(args[0]);
      let failed = false;

      try {
        return await original(...args);
      } catch (error) {
        failed = true;
        logger.error(
          { err: error, sql: sql.replace(/\s+/g, ' ').slice(0, 500), requestId: getRequestId() },
          'db query failed',
        );
        throw error;
      } finally {
        const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
        recordQuery({ sql, durationMs, requestId: getRequestId(), error: failed });

        if (durationMs >= SLOW_QUERY_MS) {
          recordSlowQuery({ sql, durationMs, requestId: getRequestId() });
          logger.warn(
            { durationMs, sql: sql.replace(/\s+/g, ' ').slice(0, 500), requestId: getRequestId() },
            'slow db query',
          );
        }
      }
    };
  }

  return target;
};

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

instrumentQueryable(pool);

// Connections handed out by getConnection are pooled objects; instrument each
// once (guarded by the symbol) so model code using connection.query is timed too.
const originalGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async (...args) => {
  const connection = await originalGetConnection(...args);
  return instrumentQueryable(connection);
};

export default pool;
