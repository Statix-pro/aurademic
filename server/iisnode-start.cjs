// This file is CommonJS (.cjs) and will be run by iisnode.

/**
 * `server.js` only calls `app.listen` when it is the process entrypoint, so
 * importing it for its side effects is not enough — the wrapper has to start the
 * listener itself. Without this the worker boots, binds nothing, and every
 * request through IIS fails with no error in the log to explain it.
 */
import('./server.js')
  .then(({ startServer }) => {
    startServer();
  })
  .catch((err) => {
    // Log any error that occurs during the dynamic import
    console.error('Error dynamically importing server.js from wrapper:', err);
    // Exit the process with an error code so iisnode knows it failed
    process.exit(1);
  });
