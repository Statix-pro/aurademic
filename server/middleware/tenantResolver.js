import { tenantStorage, getOrCreatePool } from '../config/connection.js';

/* ============================================================
   Tenant Resolver Middleware
   ============================================================
   Resolves the tenant (college) from the incoming HTTP request's
   Host header and wraps downstream handlers in a tenant-scoped
   AsyncLocalStorage context so that `db.query(...)` calls in
   models/controllers automatically route to the correct database.

   TENANT RESOLUTION STRATEGY:
   1. Check the `Host` header against the TENANT_MAP environment
      variable (a JSON map of hostname patterns → database names).
   2. If no match is found, fall back to the default database
      configured in DB_NAME (from .env).

   CONFIGURATION:
   In production .env, set TENANT_MAP as a JSON string:
     TENANT_MAP={"ksrct.ac.in":"aurademic_ksrct","othercolg.edu":"aurademic_othercolg"}

   In development, TENANT_MAP is optional — the default DB_NAME
   from .env.development is used for all requests.
   ============================================================ */

/**
 * Parse the TENANT_MAP environment variable into a lookup object.
 * Format: JSON object mapping hostname substrings to database names.
 * Example: {"ksrct.ac.in":"aurademic_ksrct","othercolg.edu":"aurademic_othercolg"}
 *
 * @returns {Object<string, string>} Map of hostname pattern → database name
 */
function parseTenantMap() {
  const raw = process.env.TENANT_MAP;
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
    console.warn('[tenant-resolver] TENANT_MAP is not a valid JSON object, ignoring.');
    return {};
  } catch (err) {
    console.warn('[tenant-resolver] Failed to parse TENANT_MAP:', err.message);
    return {};
  }
}

// Parse once at startup
const tenantMap = parseTenantMap();
const defaultDbName = process.env.DB_NAME || 'research';

if (Object.keys(tenantMap).length > 0) {
  console.log(
    `[tenant-resolver] Loaded ${Object.keys(tenantMap).length} tenant(s):`,
    Object.keys(tenantMap).join(', '),
  );
} else {
  console.log(
    '[tenant-resolver] No TENANT_MAP configured, using default database for all requests.',
  );
}

/**
 * Resolve a hostname to a database name by checking if any key
 * in the tenant map is a substring of the given host.
 *
 * @param {string} host - The Host header value (e.g. "research.ksrct.ac.in")
 * @returns {string} The resolved database name
 */
function resolveDbName(host) {
  if (!host) return defaultDbName;

  const normalizedHost = host.toLowerCase().split(':')[0]; // strip port

  for (const [pattern, dbName] of Object.entries(tenantMap)) {
    if (normalizedHost.includes(pattern.toLowerCase())) {
      return dbName;
    }
  }

  return defaultDbName;
}

/**
 * Express middleware that resolves the tenant and wraps the request
 * in a tenant-scoped AsyncLocalStorage context.
 */
export const tenantResolver = (req, res, next) => {
  const host = req.headers.host || req.hostname || '';
  const dbName = resolveDbName(host);
  const pool = getOrCreatePool(dbName);

  // Attach tenant info to the request for use by controllers if needed
  req.tenant = {
    dbName,
    host,
  };

  // Run the rest of the middleware/route chain inside the tenant context
  tenantStorage.run({ pool, dbName }, () => {
    next();
  });
};

export default tenantResolver;
