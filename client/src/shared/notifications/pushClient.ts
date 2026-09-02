/**
 * Web Push subscription management.
 *
 * Every entry point here is driven by an explicit user action. The browser
 * permission prompt is never raised on page load: browsers penalise sites that
 * do it, and users respond by blanket-denying, which is worse than not asking.
 *
 * Push is best-effort by design. Where it is unavailable — no service worker,
 * no VAPID key configured on the server, iOS Safari outside an installed PWA —
 * these functions report that plainly and the in-app bell carries on unaffected.
 */

import notificationsApi from './notificationsApi';

const SERVICE_WORKER_URL = '/sw.js';

export type PushStatus = 'unsupported' | 'unconfigured' | 'denied' | 'default' | 'subscribed';

/** Does this browser have the APIs at all? */
export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

/**
 * VAPID keys travel as base64url; `applicationServerKey` wants raw bytes.
 * Converting by hand because `atob` needs standard base64 with padding.
 */
const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  // Backed by an explicit ArrayBuffer: `applicationServerKey` requires a view
  // over one, and a plain `new Uint8Array(n)` is typed as ArrayBufferLike.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
};

const getRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  try {
    // Idempotent: registering an already-registered URL returns the existing
    // registration rather than creating a second one.
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  } catch (error) {
    console.warn('Service worker registration failed; browser push is unavailable.', error);
    return null;
  }
};

/** Where this browser currently stands, without prompting for anything. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';

  const { enabled } = await notificationsApi.getPushPublicKey().catch(() => ({
    publicKey: null,
    enabled: false,
  }));
  if (!enabled) return 'unconfigured';

  if (Notification.permission === 'denied') return 'denied';

  // Both of these reject in the wild — a browser with site data blocked, a
  // worker in a bad state. Reporting 'unsupported' is honest and, unlike
  // 'default', does not offer the user an Enable button that cannot work.
  try {
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    const existing = await registration?.pushManager.getSubscription();

    return existing ? 'subscribed' : 'default';
  } catch (error) {
    console.warn('Could not read the push subscription state.', error);
    return 'unsupported';
  }
}

/**
 * Asks permission and subscribes. Call only from a click handler.
 *
 * @returns a human-readable reason on failure, or null on success
 */
export async function enablePush(): Promise<string | null> {
  if (!isPushSupported()) {
    return 'This browser does not support push notifications.';
  }

  const { publicKey, enabled } = await notificationsApi.getPushPublicKey().catch(() => ({
    publicKey: null,
    enabled: false,
  }));
  if (!enabled || !publicKey) {
    return 'Push notifications are not configured on the server yet.';
  }

  const permission = await Notification.requestPermission().catch(() => 'denied');
  if (permission !== 'granted') {
    return permission === 'denied'
      ? 'Notifications are blocked for this site. Enable them in your browser settings.'
      : 'Permission was not granted.';
  }

  const registration = await getRegistration();
  if (!registration) return 'Could not start the background service for push notifications.';

  // The worker must be active before pushManager can be used.
  await navigator.serviceWorker.ready;

  try {
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        // Required by every current browser: a push that shows nothing to the
        // user is not allowed.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));

    await notificationsApi.subscribePush(subscription.toJSON());
    return null;
  } catch (error) {
    console.error('Push subscription failed', error);
    return 'Could not subscribe this browser to push notifications.';
  }
}

/**
 * Unsubscribes this browser. Removes the server record first: a stale server
 * row causes failed sends, whereas a stale browser subscription is harmless.
 */
export async function disablePush(): Promise<string | null> {
  if (!isPushSupported()) return null;

  let subscription: PushSubscription | null | undefined;
  try {
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
    subscription = await registration?.pushManager.getSubscription();
  } catch (error) {
    console.warn('Could not read the push subscription state.', error);
    return 'Could not reach the background service for push notifications.';
  }
  if (!subscription) return null;

  try {
    await notificationsApi.unsubscribePush(subscription.endpoint);
    await subscription.unsubscribe();
    return null;
  } catch (error) {
    console.error('Failed to remove push subscription', error);
    return 'Could not turn off push notifications for this browser.';
  }
}
