/**
 * The public face of the notification system. Domain code calls `emit()` and
 * nothing else.
 *
 *   await notificationService.emit({
 *     type: 'finance.stage_advanced',
 *     actorUserId: actor.userId,
 *     subject: { moduleKey: 'finance', recordId: 42 },
 *     audience: [
 *       { kind: 'user', userId: applicantUserId, recipientRole: 'applicant' },
 *       { kind: 'workflow_stage', moduleKey: 'finance', stageKey: 'dof',
 *         departmentId, recipientRole: 'approver' },
 *     ],
 *     data: { reference: 'FIN-42', amount: 25000, stage: 'dof' },
 *     dedupeKey: 'finance:42:stage:dof',
 *     tx: conn,
 *   });
 *
 * WHY THIS IS ONE INSERT AND NOTHING MORE
 *
 * `emit` is called from inside the transaction that made the business change —
 * an approval that also consumes budget, say. Resolving recipients and pushing
 * to browsers there would hold row locks open across network I/O, and a bug in
 * either would roll back a legitimate approval. So emit writes a single outbox
 * row that commits atomically with the business change, and the dispatcher does
 * the real work afterwards. A rolled-back approval takes its notification down
 * with it, which is exactly right and is not achievable any other way.
 *
 * WHY IT NEVER THROWS
 *
 * The worst outcome here is an approval failing because notifications are
 * broken. Every failure is logged and swallowed; `emit` returns the event id on
 * success and null on any failure, and callers are free to ignore the result.
 */

import { isKnownNotificationType } from './notificationCatalog.js';
import { scheduleDispatch } from './notificationDispatcher.js';
import notificationModel from './notificationModel.js';

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

/**
 * @returns {Promise<number|null>} the outbox row id, or null when nothing was
 *   written (unknown type, duplicate dedupe key, or a swallowed failure)
 */
export async function emit({
  type,
  actorUserId = null,
  actorName = null,
  subject = {},
  audience = [],
  data = {},
  dedupeKey = null,
  tx = undefined,
} = {}) {
  try {
    const eventType = String(type || '').trim();

    if (!isKnownNotificationType(eventType)) {
      // A typo in a type key would otherwise fail silently at dispatch time,
      // long after the deploy that introduced it.
      console.error(
        `notificationService.emit called with unknown type "${eventType}". ` +
          'Add it to notificationCatalog.js. No notification was recorded.',
      );
      return null;
    }

    if (!Array.isArray(audience) || audience.length === 0) {
      console.warn(`notificationService.emit("${eventType}") had no audience; skipping.`);
      return null;
    }

    const moduleKey = subject?.moduleKey || null;
    const recordId = toPositiveInt(subject?.recordId);

    // `data` is what the catalog templates read. Folding the subject and the
    // actor's name in here means a template never has to reach outside it.
    const payload = {
      subject,
      audience,
      data: {
        moduleKey,
        recordId,
        actorName,
        ...subject,
        ...data,
      },
    };

    const eventId = await notificationModel.insertEvent(
      {
        eventType,
        actorUserId: toPositiveInt(actorUserId),
        moduleKey,
        recordId,
        payload,
        dedupeKey,
      },
      // `undefined` lets the model fall back to the pool; passing `null`
      // explicitly would break that default.
      tx === undefined ? {} : { tx },
    );

    if (eventId) {
      // Nudge rather than dispatch inline: the caller's transaction has not
      // committed yet, so the dispatcher must not look until it has.
      scheduleDispatch();
    }

    return eventId;
  } catch (error) {
    // Deliberately swallowed. See the header: a broken notification must never
    // take down the business operation that triggered it.
    console.error(`notificationService.emit failed for type "${type}":`, error);
    return null;
  }
}

const notificationService = { emit };

export default notificationService;
