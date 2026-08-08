import logger from '../../observability/logger.js';
import { getMetricsSnapshot } from '../../observability/metrics.js';
import { resolveStack } from '../../observability/sourcemaps.js';
import {
  appendClientError,
  appendWebVital,
  readClientErrors,
  readServerErrors,
  readWebVitals,
} from '../../observability/store.js';

const clip = (value, max) => String(value ?? '').slice(0, max);

/* ================= INGEST (called by the browser) ================= */

export const ingestClientErrors = async (req, res) => {
  const errors = Array.isArray(req.body?.errors) ? req.body.errors.slice(0, 20) : [];

  for (const entry of errors) {
    // Resolve minified stack frames against production source maps so the
    // admin viewer shows original file names and line numbers.
    const resolvedStack = await resolveStack(clip(entry.stack, 8000));

    const record = {
      time: new Date().toISOString(),
      ip: req.ip,
      userAgent: clip(req.headers['user-agent'], 300),
      client: {
        sessionId: clip(entry.sessionId, 64),
        reportedEmail: clip(entry.userEmail, 200) || null,
        url: clip(entry.url, 500),
        source: clip(entry.source, 50),
        message: clip(entry.message, 2000),
        stack: resolvedStack,
        requestId: clip(entry.requestId, 64) || null,
      },
    };

    await appendClientError(record);
    logger.warn(
      {
        clientError: {
          message: record.client.message,
          url: record.client.url,
          sessionId: record.client.sessionId,
        },
      },
      'client error reported',
    );
  }

  res.json({ success: true });
};

export const ingestWebVitals = async (req, res) => {
  const vitals = Array.isArray(req.body?.vitals) ? req.body.vitals.slice(0, 30) : [];

  for (const entry of vitals) {
    await appendWebVital({
      time: new Date().toISOString(),
      sessionId: clip(entry.sessionId, 64),
      url: clip(entry.url, 500),
      name: clip(entry.name, 20),
      value: Number(entry.value) || 0,
      rating: clip(entry.rating, 30),
    });
  }

  res.json({ success: true });
};

/* ================= ADMIN (read) ================= */

export const getMetrics = (req, res) => {
  res.json({ success: true, data: getMetricsSnapshot() });
};

export const getErrors = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const [clientErrorsRaw, serverErrors] = await Promise.all([
      readClientErrors(limit),
      readServerErrors(limit),
    ]);

    // Flatten client errors for UI backward compatibility
    const clientErrors = clientErrorsRaw.map((e) => {
      if (e.client) {
        return { time: e.time, ip: e.ip, userAgent: e.userAgent, ...e.client };
      }
      return e;
    });

    res.json({ success: true, data: { clientErrors, serverErrors } });
  } catch (error) {
    next(error);
  }
};

export const getWebVitals = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 300, 1000);
    res.json({ success: true, data: await readWebVitals(limit) });
  } catch (error) {
    next(error);
  }
};
