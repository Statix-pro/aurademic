// This file is CommonJS (.cjs) and will be run by iisnode.

// Use dynamic import() to load your main ES Module application file.
// Make sure the relative path './server.js' points correctly to your main server file.
import('./server.js')
  .then(() => {
    console.log('Successfully loaded ES Module server.js via wrapper.');
    // Your server.js should handle its own logging like 'listening on port...'
  })
  .catch((err) => {
    // Log any error that occurs during the dynamic import
    console.error('Error dynamically importing server.js from wrapper:', err);
    // Exit the process with an error code so iisnode knows it failed
    process.exit(1);
  });
