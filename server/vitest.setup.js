/**
 * Test environment pinning.
 *
 * Importing `server.js` pulls in `config/env.js`, which loads
 * `.env.development` into `process.env`. That makes the suite depend on
 * whatever a given developer happens to have configured locally — and it made
 * three tests intermittently fail once real VAPID keys were added to a dev
 * `.env`, because the web push channel then reported itself enabled.
 *
 * dotenv does not overwrite variables that are already set, so assigning them
 * here (before any test file imports the app) is what makes the suite
 * deterministic on every machine.
 */

// Push is exercised through explicit mocks, never through real VAPID keys.
process.env.VAPID_PUBLIC_KEY = '';
process.env.VAPID_PRIVATE_KEY = '';
process.env.VAPID_SUBJECT = '';

// The outbox worker must never start during tests: it would poll a mocked
// connection pool on a timer and pollute unrelated assertions.
process.env.NOTIFICATIONS_DISPATCH_ENABLED = 'false';

// Several suites sign their own tokens and assume this value.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';
