/**
 * Async handler wrapper for Express route handlers.
 * Catches errors from async handlers and passes them to Express error middleware.
 * Eliminates the need for try/catch in every controller method.
 *
 * Usage:
 *   import asyncHandler from '../../middleware/asyncHandler.js';
 *   router.get('/path', asyncHandler(controller.method));
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
