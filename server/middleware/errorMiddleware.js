import logger from '../observability/logger.js';
import { appendServerError } from '../observability/store.js';

export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const requestId = req.requestId || null;

  // Always log the full error server-side (structured, with stack trace).
  logger.error(
    {
      err,
      requestId,
      method: req.method,
      path: req.originalUrl,
      userId: req.user?.id || null,
      statusCode: status,
    },
    'unhandled request error',
  );

  // Persist 5xx errors for the admin observability viewer.
  if (status >= 500) {
    appendServerError({
      time: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.originalUrl,
      userId: req.user?.id || null,
      userName: req.user?.name || null,
      userEmail: req.user?.email || null,
      userRole: req.user?.role || req.user?.roles?.[0] || null,
      statusCode: status,
      message: err.message,
      stack: err.stack,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    }).catch(() => {});
  }

  // Do not leak internal error details (DB/library internals) to clients on 5xx.
  // Client (4xx) errors may carry a safe, intentional message.
  const isClientError = status >= 400 && status < 500;
  const message = isClientError && err.message ? err.message : 'Internal Server Error';

  res.status(status).json({ error: message, requestId });
};

// Process-level capture so crashes and floating promise rejections still leave
// a stack trace in the logs. Registered once from server.js.
export const registerProcessErrorHandlers = () => {
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.error({ err }, 'unhandled promise rejection');
    appendServerError({
      time: new Date().toISOString(),
      source: 'unhandledRejection',
      message: err.message,
      stack: err.stack,
    }).catch(() => {});
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception');
    appendServerError({
      time: new Date().toISOString(),
      source: 'uncaughtException',
      message: err.message,
      stack: err.stack,
    }).catch(() => {});
  });
};
