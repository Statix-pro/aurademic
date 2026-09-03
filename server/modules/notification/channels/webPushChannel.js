/**
 * The Web Push channel.
 *
 * Sends to every live subscription the recipient has registered — a person with
 * a desktop and a laptop has two. A push service answering 404 or 410 is
 * telling us the subscription is permanently gone (site data cleared, browser
 * uninstalled), so that row is disabled rather than retried forever; any other
 * error is transient and worth another attempt.
 *
 * The VAPID keys are read once, lazily. Without them the channel reports itself
 * disabled and the dispatcher records `skipped` — the in-app notification is
 * unaffected, so a portal deployed without push configured still works.
 */

import webpush from 'web-push';

import notificationModel from '../notificationModel.js';

/**
 * Socket timeout for one push request. `web-push` hands this to https.request
 * and destroys the socket when it fires, so a push service that accepts the
 * connection and then goes quiet cannot hold a delivery open indefinitely.
 */
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Ceiling on one recipient's whole fan-out. The dispatcher renews its lease
 * between deliveries, not during one, so a single deliver() call has to stay
 * well inside the stale-claim threshold: a person with a dozen registered
 * devices must not be able to stretch one delivery past it and let the reaper
 * hand the event to another worker that pushes it all over again. Whatever is
 * left when the budget runs out is reported as a failure, which is the retry
 * ladder's cue to come back for it.
 */
const DELIVERY_BUDGET_MS = 60000;

let configured = null;

const configure = () => {
  if (configured !== null) return configured;

  const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = String(process.env.VAPID_SUBJECT || '').trim();

  if (!publicKey || !privateKey) {
    configured = false;
    return configured;
  }

  try {
    // The spec requires a mailto: or https: subject; a bad one makes every send
    // fail, so fall back to something valid rather than half-configuring.
    const safeSubject = /^(mailto:|https:\/\/)/.test(subject)
      ? subject
      : 'mailto:noreply@ksrct.ac.in';
    webpush.setVapidDetails(safeSubject, publicKey, privateKey);
    configured = true;
  } catch (error) {
    console.error('Web push VAPID configuration failed; push is disabled.', error);
    configured = false;
  }

  return configured;
};

/** Test seam: lets a test re-read env without reloading the module. */
export const resetWebPushConfig = () => {
  configured = null;
};

const webPushChannel = {
  key: 'web_push',
  label: 'Browser push',

  isEnabled() {
    return configure();
  },

  async deliver(notification, recipient) {
    if (!configure()) {
      return { status: 'skipped', error: 'VAPID keys are not configured' };
    }

    const subscriptions = await notificationModel.listPushSubscriptions(recipient.userId);
    if (!subscriptions.length) {
      return { status: 'skipped', error: 'No push subscriptions for this user' };
    }

    const body = JSON.stringify({
      title: notification.title,
      body: notification.body || '',
      link: notification.link || '/notifications',
      notificationId: notification.id,
      severity: notification.severity,
      // Collapses repeated pushes about the same record into one OS
      // notification instead of stacking them.
      tag: `${notification.event_type || notification.eventType}:${notification.id}`,
    });

    let sent = 0;
    const failures = [];
    const deadline = Date.now() + DELIVERY_BUDGET_MS;

    for (const [index, subscription] of subscriptions.entries()) {
      if (Date.now() >= deadline) {
        failures.push(
          `TIMEBUDGET: ${subscriptions.length - index} subscription(s) not attempted within ` +
            `${DELIVERY_BUDGET_MS}ms`,
        );
        break;
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
          { timeout: REQUEST_TIMEOUT_MS },
        );
        sent += 1;
      } catch (error) {
        const statusCode = error?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Gone for good. Retiring it keeps the next send from repeating this.
          await notificationModel.disablePushSubscription(subscription.endpoint);
          continue;
        }
        failures.push(`${statusCode || 'ERR'}: ${error?.message || 'unknown'}`);
      }
    }

    if (sent > 0) return { status: 'sent' };

    // Every endpoint was stale rather than broken: nothing to deliver to, and
    // nothing worth retrying.
    if (!failures.length) return { status: 'skipped', error: 'All subscriptions were expired' };

    return { status: 'failed', error: failures.join('; ') };
  },
};

export default webPushChannel;
