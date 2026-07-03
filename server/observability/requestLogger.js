import crypto from 'node:crypto';

import logger from './logger.js';
import { recordRequest } from './metrics.js';
import { runWithRequestContext } from './requestContext.js';

const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS || 1000);

// Request tracing + API latency middleware.
// - Assigns every request an id (honors an incoming X-Request-Id).
// - Runs the rest of the pipeline inside AsyncLocalStorage so all logs and
//   DB timings emitted during the request carry the same requestId.
// - Logs one structured line per completed request and feeds the metrics store.
export const requestLogger = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const startedAt = process.hrtime.bigint();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
    const userId = req.user?.id || null;

    recordRequest({
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      requestId,
      userId,
    });

    const logPayload = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error(logPayload, 'request failed');
    } else if (res.statusCode >= 400) {
      logger.warn(logPayload, 'request rejected');
    } else if (durationMs >= SLOW_REQUEST_MS) {
      logger.warn(logPayload, 'slow request');
    } else {
      logger.info(logPayload, 'request completed');
    }
  });

  // `req` is kept on the context so logs emitted after auth runs can resolve
  // the user id lazily (req.user is not populated yet at this point).
  runWithRequestContext({ requestId, req }, () => next());
};
