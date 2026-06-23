/* ============================================================
   Tenant Metadata Controller
   ============================================================
   Returns branding and configuration metadata for the current
   tenant based on the request hostname. This endpoint is PUBLIC
   (no auth required) — the React frontend calls it on app load
   to configure branding, colors, and college-specific settings.

   HOW TO EXTEND:
   When you onboard a new college, add an entry to the
   `TENANT_BRANDING` map below. In a future version, this can
   be moved to a `tenants` table in a master database.
   ============================================================ */

/**
 * Static branding configuration map.
 * Keys are hostname substrings (matched against the Host header).
 * Values are branding objects returned to the frontend.
 *
 * To add a new tenant, add a new entry here and in the
 * TENANT_MAP environment variable (see tenantResolver.js).
 */
const TENANT_BRANDING = {
  'ksrct.ac.in': {
    collegeId: 'ksrct',
    collegeName: 'K.S. Rangasamy College of Technology',
    shortName: 'KSRCT',
    logoUrl: '/logos/ksrct-logo.png',
    primaryColor: '#0069ab',
    primaryHover: '#005492',
    secondaryColor: '#5d6b8a',
    tagline: 'An Autonomous Institution',
  },
};

/** Default branding when no tenant match is found (local development). */
const DEFAULT_BRANDING = {
  collegeId: 'default',
  collegeName: 'Research Portal',
  shortName: 'Portal',
  logoUrl: '/logos/default-logo.png',
  primaryColor: '#0069ab',
  primaryHover: '#005492',
  secondaryColor: '#5d6b8a',
  tagline: 'Academic Research Management',
};

/**
 * Resolve branding for the given hostname.
 * Checks if any key in TENANT_BRANDING is a substring of the host.
 */
function resolveBranding(host) {
  if (!host) return DEFAULT_BRANDING;

  const normalizedHost = host.toLowerCase().split(':')[0];

  for (const [pattern, branding] of Object.entries(TENANT_BRANDING)) {
    if (normalizedHost.includes(pattern.toLowerCase())) {
      return branding;
    }
  }

  return DEFAULT_BRANDING;
}

/**
 * GET /api/tenant/metadata
 * Returns branding and configuration for the current tenant.
 * Determines the portal mode (admin vs student) from the hostname.
 */
export const getTenantMetadata = (req, res) => {
  const host = req.headers.host || req.hostname || '';
  const branding = resolveBranding(host);

  // Determine portal mode from hostname subdomain
  const normalizedHost = host.toLowerCase().split(':')[0];
  let portalMode = 'admin'; // default
  if (normalizedHost.startsWith('event.') || normalizedHost.startsWith('events.')) {
    portalMode = 'student';
  }

  res.status(200).json({
    ...branding,
    portalMode,
    host: normalizedHost,
  });
};
