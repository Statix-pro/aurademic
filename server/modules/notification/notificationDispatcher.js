/**
 * The outbox worker.
 *
 * Claims committed events, resolves their audience, writes one notification per
 * recipient, and hands each one to the channels the recipient has left enabled.
 * Runs on a timer plus a debounced nudge from `emit`, so a notification usually
 * lands within a second of the approval that caused it while the timer remains
 * the safety net for anything the nudge missed.
 *
 * Everything here is idempotent. A crash between writing notifications and
 * completing deliveries leaves the event claimed; the stale-claim reaper
 * returns it to the pool, and reprocessing writes no duplicate rows because
 * `notifications` is uniquely keyed on (event_id, user_id) and only 'pending'
 * deliveries are ever sent.
 */

import { getChannel, listChannels } from './channels/index.js';
import { CHANNELS, renderNotification, getNotificationType } from './notificationCatalog.js';
import notificationModel from './notificationModel.js';
import { resolveRecipients } from './recipientResolver.js';

/** Backoff between retries, in seconds. Index is the attempt number. */
const RETRY_DELAYS_SECONDS = [60, 300, 1800, 7200];
const MAX_ATTEMPTS = RETRY_DELAYS_SECONDS.length + 1;

const DEFAULT_INTERVAL_MS = 10000;
const NUDGE_DELAY_MS = 700;
const BATCH_SIZE = 25;
const STALE_CLAIM_MINUTES = 5;
/**
 * How often a claimed event's lease is restamped while it is being processed.
 *
 * Derived from the stale threshold rather than set beside it: a future change
 * to `STALE_CLAIM_MINUTES` moves the heartbeat with it instead of silently
 * leaving it too slow to keep a lease alive. A fifth of the threshold gives
 * four consecutive beats the room to fail before the reaper is entitled to
 * treat the claim as abandoned.
 */
const LEASE_RENEW_INTERVAL_MS = Math.max(5000, Math.floor((STALE_CLAIM_MINUTES * 60000) / 5));
const STALE_CLAIM_MS = STALE_CLAIM_MINUTES * 60000;
/**
 * Slack subtracted from the remaining lease before a delivery is allowed to
 * start. The heartbeat learns a renewal succeeded when the reply arrives, so
 * the row's real age is a round trip older than this process thinks; the margin
 * covers that, a beat that has just been missed, and clock drift between here
 * and the database.
 */
const LEASE_SAFETY_MARGIN_MS = LEASE_RENEW_INTERVAL_MS;
/**
 * What a channel is assumed to need when it does not say. Channels are asked to
 * declare `maxDeliveryMs` (see channels/index.js); this is the fallback for one
 * that forgets, deliberately generous rather than optimistic.
 */
const DEFAULT_MAX_DELIVERY_MS = 60000;
/**
 * How often to look for stranded claims. Tied to elapsed time rather than a
 * sweep counter so it stays right whichever dispatch interval is configured.
 */
const STALE_REAP_INTERVAL_MS = 60000;

/**
 * Prefixes this process's claims. Two iisnode workers, or a dev server plus a
 * script, must not read each other's claimed rows. `claimPendingEvents` adds a
 * per-claim suffix and returns the result as the lease token for that batch,
 * which is what the writes below are fenced on — this constant only makes the
 * owner legible in the table.
 */
const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

let intervalHandle = null;
let nudgeHandle = null;
let running = false;
let lastReapAt = 0;

const parsePayload = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

/**
 * Does this user want this channel for this event type?
 *
 * Precedence: an exact per-type row, then a per-category wildcard row, then the
 * catalog default. Preferences are stored sparsely, so most lookups fall
 * straight through to the default and a new user needs no seeding.
 */
const isChannelWanted = ({
  preferences,
  userId,
  eventType,
  category,
  channel,
  defaultChannels,
}) => {
  const exact = preferences.find(
    (row) => row.user_id === userId && row.event_type === eventType && row.channel === channel,
  );
  if (exact) return Boolean(exact.is_enabled);

  const wildcard = preferences.find(
    (row) =>
      row.user_id === userId &&
      row.event_type === '*' &&
      row.category === category &&
      row.channel === channel,
  );
  if (wildcard) return Boolean(wildcard.is_enabled);

  return defaultChannels.includes(channel);
};

/**
 * Fills in the human names templates want, when the emitter did not supply
 * them. Emitters run inside a business transaction and should not pay for a
 * join to make a sentence read better, so the lookup happens here instead.
 *
 * Mutates `data` in place — it is a fresh object parsed from the payload, not
 * shared state. A failure is not worth retrying an event over: the templates
 * all fall back to wording like "the approver".
 */
async function enrichActorNames(event, data) {
  const needed = [];
  if (!data.actorName && event.actor_user_id) needed.push(event.actor_user_id);
  if (!data.applicantName && data.applicantUserId) needed.push(data.applicantUserId);
  if (!needed.length) return;

  try {
    const names = await notificationModel.getUserNames(needed);
    if (!data.actorName && event.actor_user_id) {
      data.actorName = names.get(Number(event.actor_user_id)) || null;
    }
    if (!data.applicantName && data.applicantUserId) {
      data.applicantName = names.get(Number(data.applicantUserId)) || null;
    }
  } catch (error) {
    console.warn('Could not resolve display names for notification event', event.id, error.message);
  }
}

/**
 * Keeps this worker's lease on one event alive for as long as it is being
 * processed.
 *
 * A timer rather than a check between deliveries, because the thing that takes
 * the time — `channel.deliver` — is a single await this loop cannot interrupt.
 * A check placed around it only holds while every individual delivery stays
 * well inside the stale threshold, which is a promise about code that has not
 * been written yet: the next channel is an email or an SMS gateway with its own
 * timeout policy. Heartbeating instead makes the lease independent of how long
 * any one delivery takes, so a slow channel is merely slow rather than a source
 * of duplicate notifications.
 *
 * `renewClaim` is fenced on the lease token, so once the reaper has released
 * the row (or another worker has claimed it) the renewal matches nothing and
 * reports false. That is latched into `isLost`, which the delivery loop checks
 * before it sends anything else.
 *
 * A renewal that throws is treated as transient and simply retried on the next
 * beat: a database blip is not evidence that the lease is gone, and the reaper
 * cannot have run during one either.
 */
function startLeaseHeartbeat(eventId, token) {
  let lost = false;
  let inFlight = false;
  // Set from the stamp runOnce took immediately before calling us.
  let lastRenewAt = Date.now();

  const beat = async () => {
    if (inFlight || lost) return;
    inFlight = true;
    try {
      if (await notificationModel.renewClaim(eventId, { lockedBy: token })) {
        lastRenewAt = Date.now();
      } else {
        lost = true;
      }
    } catch (error) {
      console.warn(
        `Could not renew the lease on notification event ${eventId}:`,
        error?.message || error,
      );
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(() => void beat(), LEASE_RENEW_INTERVAL_MS);
  // Never a reason to hold the process open: the sweep that owns this
  // heartbeat is what matters, and it stops the timer when it is done.
  if (typeof timer.unref === 'function') timer.unref();

  return {
    /**
     * Is this worker still certain it will own the event for the next `ms`?
     *
     * Two ways to answer no. The lease was revoked — a renewal came back
     * fenced out — or it has simply gone unrenewed for too long: renewals that
     * keep failing (this process's connection pool exhausted, its database
     * link cut) leave the row untouched, and once it is older than the stale
     * threshold the reaper is entitled to give it away whether or not this
     * worker has noticed. A lease holder has to expire itself on the clock
     * rather than wait to be told, which is the whole point of a lease.
     *
     * The `ms` is what makes it safe to *start* something: a delivery is not
     * begun unless the lease outlasts the worst case for that delivery, so no
     * push is ever in flight after another worker could have taken the event.
     */
    holdsFor: (ms = 0) =>
      !lost && Date.now() - lastRenewAt + ms + LEASE_SAFETY_MARGIN_MS < STALE_CLAIM_MS,
    stop: () => clearInterval(timer),
  };
}

async function processEvent(event, token) {
  // runOnce restamped the lease immediately before calling us, so the first
  // beat is due one interval from now.
  const lease = startLeaseHeartbeat(event.id, token);
  try {
    return await fanOutEvent(event, token, lease);
  } finally {
    lease.stop();
  }
}

async function fanOutEvent(event, token, lease) {
  const payload = parsePayload(event.payload);
  const data = payload.data || {};
  const audience = Array.isArray(payload.audience) ? payload.audience : [];

  const catalogEntry = getNotificationType(event.event_type);
  if (!catalogEntry) {
    // The type was removed from the catalog after the event was queued. There
    // is no way to render it, and retrying will never help.
    await notificationModel.markEventFailed(event.id, {
      error: `Unknown notification type: ${event.event_type}`,
      lockedBy: token,
    });
    return;
  }

  const { recipients, errors } = await resolveRecipients({
    audience,
    actorUserId: event.actor_user_id,
  });

  if (!recipients.length) {
    // Nobody to tell is a legitimate outcome — a department with no HOD
    // assigned, or an event whose only recipient was the actor.
    if (errors.length) throw new Error(`No recipients resolved: ${errors.join('; ')}`);
    await notificationModel.markEventDone(event.id, { lockedBy: token });
    return;
  }

  await enrichActorNames(event, data);

  // Rendering depends only on the recipient role, so render once per distinct
  // role rather than once per person.
  const renderedByRole = new Map();
  const rows = recipients.map(({ userId, recipientRole }) => {
    if (!renderedByRole.has(recipientRole)) {
      renderedByRole.set(recipientRole, renderNotification(event.event_type, data, recipientRole));
    }
    const rendered = renderedByRole.get(recipientRole);
    return { ...rendered, userId, recipientRole };
  });

  const notifications = await notificationModel.insertNotifications(event.id, rows);

  const preferences = await notificationModel.getPreferencesForUsers(
    notifications.map((row) => row.user_id),
  );

  const defaultChannels = catalogEntry.defaultChannels || ['in_app'];
  const deliveryRows = [];

  for (const notification of notifications) {
    // Every known channel is considered, not just the defaults, so a user can
    // opt IN to browser push for a type that ships as in-app only.
    for (const channelKey of CHANNELS) {
      const channel = getChannel(channelKey);
      if (!channel) continue;

      const wanted = isChannelWanted({
        preferences,
        userId: notification.user_id,
        eventType: notification.event_type,
        category: notification.category,
        channel: channelKey,
        defaultChannels,
      });

      if (!wanted) {
        deliveryRows.push({
          notificationId: notification.id,
          channel: channelKey,
          status: 'skipped',
        });
        continue;
      }

      if (!channel.isEnabled()) {
        deliveryRows.push({
          notificationId: notification.id,
          channel: channelKey,
          status: 'skipped',
        });
        continue;
      }

      deliveryRows.push({
        notificationId: notification.id,
        channel: channelKey,
        status: 'pending',
      });
    }
  }

  await notificationModel.insertDeliveries(deliveryRows);

  // Re-read rather than trusting the list above: this returns only what is
  // still owed, so a reprocessed event does not push twice.
  const pending = await notificationModel.listPendingDeliveries(event.id);

  const failedDeliveries = [];

  for (const delivery of pending) {
    const channel = getChannel(delivery.channel);
    if (!channel) continue;

    // Only start a delivery this lease is certain to outlive. If the event has
    // been taken away — or the lease has gone unrenewed long enough that the
    // reaper could take it away before this send returns — stop: another worker
    // is, or is about to be, sending exactly these still-'pending' rows, and
    // two workers in the same push means the recipient hears twice. Whatever
    // went out above has been marked, so the new owner will not repeat it, and
    // whatever is left stays 'pending' for it to finish.
    const worstCase = Number(channel.maxDeliveryMs) || DEFAULT_MAX_DELIVERY_MS;
    if (!lease.holdsFor(worstCase)) {
      console.warn(
        `Notification event ${event.id} (${event.event_type}) can no longer vouch for its claim ` +
          'mid-delivery; stopping so the worker that holds it now can finish the rest',
      );
      return;
    }

    let outcome;
    try {
      outcome = await channel.deliver(
        {
          id: delivery.notification_id,
          eventType: delivery.event_type,
          event_type: delivery.event_type,
          category: delivery.category,
          severity: delivery.severity,
          title: delivery.title,
          body: delivery.body,
          link: delivery.link,
        },
        { userId: delivery.user_id },
      );
    } catch (error) {
      // A channel is contracted not to throw, but a bug in one must not stop
      // the others from delivering.
      outcome = { status: 'failed', error: error?.message || 'Channel threw' };
    }

    const status = outcome?.status || 'failed';

    await notificationModel.markDelivery(delivery.notification_id, delivery.channel, {
      status,
      error: outcome?.error || null,
    });

    if (status === 'failed') {
      failedDeliveries.push(
        `${delivery.channel} to user ${delivery.user_id}: ${outcome?.error || 'unknown error'}`,
      );
    }
  }

  // A descriptor that failed to resolve is worth another pass: the retry adds
  // the missing recipients without disturbing the ones already notified.
  if (errors.length) throw new Error(`Partial audience resolution: ${errors.join('; ')}`);

  // A 'failed' delivery means the channel judged the failure transient — a push
  // service that answered 404/410 reports 'skipped' instead, precisely so it is
  // not retried. Throwing hands the event back to the retry ladder in runOnce,
  // which is the only thing that ever looks at it again: `listPendingDeliveries`
  // reads 'pending' rows only, so a failure left behind here would never be
  // reattempted and the recipient would simply never hear. On the next pass
  // `insertDeliveries` resets these rows to 'pending' while leaving 'sent' ones
  // alone, so nobody is pushed to twice, and MAX_ATTEMPTS bounds the ladder.
  if (failedDeliveries.length) {
    throw new Error(
      `${failedDeliveries.length} of ${pending.length} deliveries failed: ` +
        failedDeliveries.slice(0, 3).join(' | '),
    );
  }

  await notificationModel.markEventDone(event.id, { lockedBy: token });
}

/**
 * One pass: release anything stranded, claim a batch, process it.
 * Never throws — a dispatch failure must not take down the timer.
 *
 * @returns {Promise<number>} how many events were processed
 */
export async function runOnce() {
  if (running) return 0;
  running = true;

  try {
    // Cheap, but pointless on every sweep; about once a minute recovers from a
    // crash without adding a constant UPDATE to the tick.
    if (Date.now() - lastReapAt >= STALE_REAP_INTERVAL_MS) {
      lastReapAt = Date.now();
      const reaped = await notificationModel.releaseStaleClaims({
        staleMinutes: STALE_CLAIM_MINUTES,
        // A reap counts as an attempt, so an event that strands every worker
        // that touches it lands on 'failed' rather than circling forever.
        maxAttempts: MAX_ATTEMPTS,
      });
      if (reaped?.failed) {
        console.error(
          `${reaped.failed} notification event(s) gave up after repeatedly going stale mid-flight`,
        );
      }
    }

    // `token` is this claim's lease: every write below is fenced on it, so a
    // batch the reaper took away cannot be finished by its former owner.
    const { token, events } = await notificationModel.claimPendingEvents({
      limit: BATCH_SIZE,
      lockedBy: INSTANCE_ID,
    });

    for (const event of events) {
      // A batch is processed one event at a time, so the last event of a slow
      // batch could sit claimed for longer than the stale threshold and be
      // reaped out from under this worker. Restamping the lease as each event
      // starts keeps the threshold measuring one event's runtime.
      const held = await notificationModel.renewClaim(event.id, { lockedBy: token });
      if (!held) {
        console.warn(
          `Notification event ${event.id} (${event.event_type}) lost its claim before ` +
            'processing; leaving it to the worker that holds it now',
        );
        continue;
      }

      try {
        await processEvent(event, token);
      } catch (error) {
        const attempts = Number(event.attempts || 0);
        const message = error?.message || 'Unknown dispatch error';

        // These writes are fenced on the lease, so they report whether they
        // actually applied. Logging the outcome rather than the intent keeps
        // the log from promising a retry that was never recorded, which is
        // what happens when the lease lapsed while the event was in flight.
        if (attempts + 1 >= MAX_ATTEMPTS) {
          const applied = await notificationModel.markEventFailed(event.id, {
            error: message,
            lockedBy: token,
          });
          if (applied) {
            console.error(
              `Notification event ${event.id} (${event.event_type}) failed permanently: ${message}`,
            );
          } else {
            console.warn(
              `Notification event ${event.id} (${event.event_type}) failed (${message}) but its ` +
                'claim was already gone; leaving it to the worker that holds it now',
            );
          }
        } else {
          const delay = RETRY_DELAYS_SECONDS[attempts] ?? RETRY_DELAYS_SECONDS.at(-1);
          const applied = await notificationModel.markEventForRetry(event.id, {
            error: message,
            delaySeconds: delay,
            lockedBy: token,
          });
          if (applied) {
            console.warn(
              `Notification event ${event.id} (${event.event_type}) failed, ` +
                `retrying in ${delay}s: ${message}`,
            );
          } else {
            console.warn(
              `Notification event ${event.id} (${event.event_type}) failed (${message}) but its ` +
                'claim was already gone; leaving it to the worker that holds it now',
            );
          }
        }
      }
    }

    return events.length;
  } catch (error) {
    console.error('Notification dispatcher sweep failed:', error);
    return 0;
  } finally {
    running = false;
  }
}

/**
 * Asks for a dispatch shortly. Debounced, and deliberately delayed: `emit` runs
 * inside an uncommitted transaction, so an immediate claim would see nothing.
 * If the delay still beats the commit, the timer picks the event up next sweep.
 */
export function scheduleDispatch() {
  if (!intervalHandle) return; // dispatcher not started (tests, scripts)
  if (nudgeHandle) return;

  nudgeHandle = setTimeout(() => {
    nudgeHandle = null;
    void runOnce();
  }, NUDGE_DELAY_MS);

  if (typeof nudgeHandle.unref === 'function') nudgeHandle.unref();
}

export function startDispatcher({ intervalMs } = {}) {
  if (intervalHandle) return false;

  const interval = Number(
    intervalMs ?? process.env.NOTIFICATIONS_DISPATCH_INTERVAL_MS ?? DEFAULT_INTERVAL_MS,
  );
  const safeInterval =
    Number.isFinite(interval) && interval >= 1000 ? interval : DEFAULT_INTERVAL_MS;

  intervalHandle = setInterval(() => void runOnce(), safeInterval);
  // Do not hold the process open on its own account.
  if (typeof intervalHandle.unref === 'function') intervalHandle.unref();

  console.log(
    `Notification dispatcher started (every ${safeInterval}ms, channels: ` +
      `${listChannels()
        .map((c) => `${c.key}${c.isEnabled() ? '' : ' [disabled]'}`)
        .join(', ')})`,
  );

  void runOnce();
  return true;
}

export function stopDispatcher() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (nudgeHandle) {
    clearTimeout(nudgeHandle);
    nudgeHandle = null;
  }
}

/** Lets a test start from a clean slate instead of inheriting sweep history. */
const resetSweepState = () => {
  lastReapAt = 0;
  running = false;
};

export const __testing = {
  processEvent,
  isChannelWanted,
  resetSweepState,
  INSTANCE_ID,
  MAX_ATTEMPTS,
  RETRY_DELAYS_SECONDS,
  STALE_CLAIM_MINUTES,
  LEASE_RENEW_INTERVAL_MS,
};

export default { startDispatcher, stopDispatcher, runOnce, scheduleDispatch };
