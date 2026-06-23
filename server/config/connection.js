import mysql from 'mysql2/promise';
import { AsyncLocalStorage } from 'async_hooks';

/* ============================================================
   Multi-Tenant Database Connection Layer
   ============================================================
   Uses AsyncLocalStorage + JavaScript Proxy to dynamically route
   database queries to the correct tenant's connection pool based
   on the incoming HTTP request's hostname.

   HOW IT WORKS:
   1. The `tenantResolver` middleware (see middleware/tenantResolver.js)
      resolves the tenant from the request Host header and calls
      `tenantStorage.run({ pool: tenantPool }, next)`.
   2. All downstream code imports `db` from this file and calls
      `db.query(...)` / `db.execute(...)` as usual.
   3. The Proxy intercepts these calls and forwards them to the
      active tenant's connection pool (or the default pool if no
      tenant context is set — e.g., during tests or CLI scripts).

   IMPORTANT: No changes are required in any model or controller file.
   ============================================================ */

// AsyncLocalStorage instance to hold per-request tenant context
export const tenantStorage = new AsyncLocalStorage();

// Cache of connection pools keyed by database name
const poolCache = new Map();

/**
 * Default connection pool configuration derived from environment variables.
 * Used as the fallback when no tenant context is active (local dev, tests, scripts).
 */
const defaultPoolConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
};

/**
 * Creates or retrieves a cached connection pool for the given database name.
 * All pools share the same host/user/password credentials (from .env),
 * differing only in the `database` field.
 *
 * @param {string} dbName - The MySQL database name for the tenant.
 * @returns {import('mysql2/promise').Pool} A mysql2 connection pool.
 */
export function getOrCreatePool(dbName) {
  if (poolCache.has(dbName)) {
    return poolCache.get(dbName);
  }

  const pool = mysql.createPool({
    ...defaultPoolConfig,
    database: dbName,
  });

  poolCache.set(dbName, pool);
  console.log(`[tenant-db] Created connection pool for database: ${dbName}`);
  return pool;
}

// Create the default pool eagerly so it's available immediately
const defaultPool = getOrCreatePool(process.env.DB_NAME || 'research');

/**
 * The `db` proxy. All existing code does `import db from '../../config/connection.js'`
 * and calls `db.query(...)`, `db.execute(...)`, `db.getConnection()`, etc.
 *
 * The Proxy intercepts property access and delegates to whichever pool
 * is active in the current AsyncLocalStorage context.
 */
const db = new Proxy(
  {},
  {
    get(_target, prop) {
      // Resolve the active pool: tenant-specific if inside a request, else default
      const store = tenantStorage.getStore();
      const activePool = store?.pool || defaultPool;

      const value = activePool[prop];

      // If the property is a function (query, execute, getConnection, etc.),
      // bind it to the active pool so `this` is correct
      if (typeof value === 'function') {
        return value.bind(activePool);
      }

      return value;
    },
  },
);

export default db;
