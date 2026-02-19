import crypto from 'crypto';

/**
 * Assigns a unique request ID to every incoming request.
 * - Uses the client-provided X-Request-Id header if present (for tracing across services)
 * - Otherwise generates a new UUID
 * - Attaches it to req.id and sets the response header
 */
const requestId = (req, res, next) => {
    const id = req.headers['x-request-id'] || crypto.randomUUID();
    req.id = id;
    res.setHeader('X-Request-Id', id);
    next();
};

export default requestId;
