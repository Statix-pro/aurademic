// Lightweight browser telemetry: JS errors, unhandled promise rejections,
// failed API calls and web vitals, batched to the backend observability
// endpoints. Self-hosted — no third-party service involved.

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const SESSION_KEY = 'obs-session-id';

let fallbackSessionId: string | null = null;

const createSessionId = (): string => {
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const randomPart = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `obs-${Date.now()}-${randomPart}`;
};

export const getObservabilitySessionId = (): string => {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = createSessionId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    if (!fallbackSessionId) {
      try {
        fallbackSessionId = createSessionId();
      } catch {
        // Ultimate fallback if both storage and crypto fail
        fallbackSessionId = `obs-${Date.now()}-fallback`;
      }
    }
    return fallbackSessionId;
  }
};

const getUserEmail = (): string | null => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string };
    return parsed.email || null;
  } catch {
    return null;
  }
};

interface ClientErrorRecord {
  sessionId: string;
  userEmail: string | null;
  url: string;
  source: string;
  message: string;
  stack?: string;
  requestId?: string | null;
}

const errorQueue: ClientErrorRecord[] = [];
let flushTimer: number | null = null;
const seenRecently = new Map<string, number>();

const postJson = (path: string, body: unknown) => {
  const payload = JSON.stringify(body);
  // sendBeacon survives page unload; fall back to fetch with keepalive.
  const url = `${API_BASE}/observability/${path}`;
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    if (navigator.sendBeacon(url, blob)) return;
  }
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {});
};

const flushErrors = () => {
  flushTimer = null;
  if (errorQueue.length === 0) return;
  const errors = errorQueue.splice(0, 20);
  postJson('client-errors', { errors });
};

export const reportClientError = (entry: {
  source: string;
  message: string;
  stack?: string;
  requestId?: string | null;
}) => {
  // De-duplicate identical errors fired in a tight loop (e.g. render errors).
  const key = `${entry.source}:${entry.message}`;
  const now = Date.now();
  const last = seenRecently.get(key);
  if (last && now - last < 10_000) return;
  seenRecently.set(key, now);

  errorQueue.push({
    sessionId: getObservabilitySessionId(),
    userEmail: getUserEmail(),
    url: window.location.href,
    ...entry,
  });

  if (flushTimer === null) {
    flushTimer = window.setTimeout(flushErrors, 3000);
  }
};

/* ================= WEB VITALS ================= */

const vitalRating = (name: string, value: number): string => {
  const thresholds: Record<string, [number, number]> = {
    CLS: [0.1, 0.25],
    FID: [100, 300],
    LCP: [2500, 4000],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
  };
  const t = thresholds[name];
  if (!t) return 'unknown';
  if (value <= t[0]) return 'good';
  if (value <= t[1]) return 'needs-improvement';
  return 'poor';
};

const initWebVitals = async () => {
  try {
    const { getCLS, getFID, getLCP, getFCP, getTTFB } = await import('web-vitals');
    const report = (metric: { name: string; value: number }) => {
      postJson('web-vitals', {
        vitals: [
          {
            sessionId: getObservabilitySessionId(),
            url: window.location.pathname,
            name: metric.name,
            value: Math.round(metric.value * 100) / 100,
            rating: vitalRating(metric.name, metric.value),
          },
        ],
      });
    };
    getCLS(report);
    getFID(report);
    getLCP(report);
    getFCP(report);
    getTTFB(report);
  } catch {
    // web-vitals unavailable — non-fatal
  }
};

/* ================= INIT ================= */

let initialized = false;

export const initTelemetry = () => {
  if (initialized) return;
  initialized = true;

  window.addEventListener('error', (event) => {
    reportClientError({
      source: 'window.onerror',
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportClientError({
      source: 'unhandledrejection',
      message: reason?.message || String(reason ?? 'Unhandled rejection'),
      stack: reason?.stack,
    });
  });

  window.addEventListener('pagehide', flushErrors);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushErrors();
  });

  initWebVitals();
};
