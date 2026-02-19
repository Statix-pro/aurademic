import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry error tracking.
 * Call this BEFORE any other imports/middleware in server.js.
 *
 * Requires SENTRY_DSN environment variable.
 * If SENTRY_DSN is not set, Sentry is silently disabled.
 */
export function initSentry(app) {
    if (!process.env.SENTRY_DSN) {
        return;
    }

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',

        // Capture 100% of errors, sample 10% of performance transactions
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // Don't send PII (emails, IPs) unless explicitly needed
        sendDefaultPii: false,
    });

    // The request handler must be the first middleware on the app
    Sentry.setupExpressErrorHandler(app);
}

export { Sentry };
