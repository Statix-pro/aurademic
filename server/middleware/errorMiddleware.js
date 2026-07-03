export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;

  // Always log the full error server-side for diagnostics.
  console.error('Unhandled error:', err);

  // Do not leak internal error details (DB/library internals) to clients on 5xx.
  // Client (4xx) errors may carry a safe, intentional message.
  const isClientError = status >= 400 && status < 500;
  const message = isClientError && err.message ? err.message : 'Internal Server Error';

  res.status(status).json({ error: message });
};
