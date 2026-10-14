/**
 * Notification retention.
 *
 * The notification tables grow with every approval in the institution and
 * nothing else prunes them, so this ships with the feature rather than after
 * the first time someone notices the table size.
 *
 * Two passes, both conservative:
 *   1. Read notifications older than the archive window are archived, not
 *      deleted. They vanish from the bell and the inbox but remain readable for
 *      audit, and an unread notification is never touched however old it is —
 *      if nobody has acknowledged it, it still matters.
 *   2. Outbox events that have finished (done or failed) and are older than the
 *      event window are deleted outright. Their `notifications` rows go with
 *      them by ON DELETE CASCADE, which is why this window is the longer of the
 *      two — and why an event still holding an unread notification is skipped,
 *      so the cascade cannot take away what pass 1 promised to keep.
 *
 * Usage:
 *   npm run purge:notifications                       # 90 / 180 day defaults
 *   npm run purge:notifications -- --read-days=30 --event-days=90
 *   npm run purge:notifications -- --dry-run
 */

import '../config/env.js';

import db from '../config/connection.js';
import notificationModel from '../modules/notification/notificationModel.js';

const parseArg = (name, fallback) => {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!match) return fallback;
  const value = Number.parseInt(match.split('=')[1], 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const isDryRun = process.argv.includes('--dry-run');

async function countCandidates(readDays, eventDays) {
  const [[notifications]] = await db.query(
    `SELECT COUNT(*) AS total
       FROM notifications
      WHERE archived_at IS NULL
        AND is_read = 1
        AND created_at < (NOW() - INTERVAL ? DAY)`,
    [readDays],
  );

  const [[events]] = await db.query(
    `SELECT COUNT(*) AS total
       FROM notification_events e
      WHERE e.status IN ('done', 'failed')
        AND e.created_at < (NOW() - INTERVAL ? DAY)
        AND NOT EXISTS (
          SELECT 1 FROM notifications n WHERE n.event_id = e.id AND n.is_read = 0
        )`,
    [eventDays],
  );

  return { notifications: notifications.total, events: events.total };
}

async function main() {
  const readDays = parseArg('read-days', 90);
  const eventDays = parseArg('event-days', 180);

  console.log(
    `Notification purge — archiving read notifications older than ${readDays} days, ` +
      `deleting finished events older than ${eventDays} days${isDryRun ? ' (DRY RUN)' : ''}`,
  );

  if (isDryRun) {
    const { notifications, events } = await countCandidates(readDays, eventDays);
    console.log(`Would archive ${notifications} notification(s).`);
    console.log(`Would delete ${events} outbox event(s) and their notifications.`);
    return;
  }

  const archived = await notificationModel.purgeOldNotifications({
    readOlderThanDays: readDays,
  });
  console.log(`Archived ${archived} read notification(s).`);

  const deleted = await notificationModel.purgeOldEvents({ olderThanDays: eventDays });
  console.log(`Deleted ${deleted} finished outbox event(s).`);
}

main()
  .catch((error) => {
    console.error('Notification purge failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
