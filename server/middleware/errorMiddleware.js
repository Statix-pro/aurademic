import logger from '../config/logger.js';

export const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  // Log with full context including request ID
  logger.error(`${req.method} ${req.path} → ${status}: ${err.message}`, {
    requestId: req.id,
    stack: err.stack,
    body: req.body && Object.keys(req.body).length > 0 ? '[present]' : undefined,
    params: req.params,
    query: req.query,
  });

  // Don't leak stack traces in production
  const response = {
    success: false,
    error: err.message || 'Internal Server Error',
    requestId: req.id,
  };

  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(status).json(response);
};
