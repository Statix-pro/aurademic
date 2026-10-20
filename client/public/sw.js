/* eslint-disable no-undef */
/**
 * Service worker for Web Push.
 *
 * Deliberately minimal: it handles push display and click-through and nothing
 * else. In particular it does NOT cache or intercept fetches — turning this app
 * into an offline PWA is a separate decision with its own consequences for a
 * portal whose data must never be stale, and a caching worker added by accident
 * is very hard to undo in users' browsers.
 *
 * Served from `public/` at the site root, which is required: a worker can only
 * control pages at or below its own path.
 */

self.addEventListener('install', () => {
  // Take over immediately rather than waiting for every tab to close, so a
  // newly-subscribed user does not have to restart their browser.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    const parsed = event.data ? event.data.json() : null;
    // `json()` only throws on text that is not JSON. A payload of `null`, a
    // number or a string parses cleanly and would then throw on `.title`
    // below, which is the one thing this handler must never do.
    if (parsed && typeof parsed === 'object') payload = parsed;
  } catch {
    // A malformed payload still deserves a notification: the browser has
    // already promised the user that a push will show something.
    payload = {};
  }

  const title = payload.title || 'Aurademic';
  const options = {
    body: payload.body || '',
    // `tag` collapses repeated pushes about the same record into one entry
    // instead of stacking them.
    tag: payload.tag || undefined,
    data: { link: payload.link || '/notifications', notificationId: payload.notificationId },
    icon: '/favicon.ico',
    badge: '/favicon.ico',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = (event.notification.data && event.notification.data.link) || '/notifications';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Prefer focusing a tab that is already open on this origin and
      // navigating it, rather than opening yet another copy of the portal.
      for (const client of allClients) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ('navigate' in client) {
            await client.navigate(link);
          }
          return;
        }
      }

      await self.clients.openWindow(link);
    })(),
  );
});
