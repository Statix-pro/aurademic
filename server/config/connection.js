import mysql from 'mysql2/promise';

/**
 * Two naming schemes are supported, because the production box and this repo
 * disagree: prod's `.env` predates the rename and still says HOST/USER/PASSWORD/DB,
 * while every env file here says DB_HOST/DB_USER/DB_PASSWORD/DB_NAME. Reading
 * both means the tree can be deployed over prod without editing its env file
 * first — the failure it avoids is silent, a pool built entirely from
 * `undefined` that surfaces later as a connection error rather than a config one.
 *
 * The choice is deliberately all-or-nothing rather than per-key. `USER` and
 * `HOST` are names the operating system itself sets, so a per-key fallback on a
 * half-configured box would quietly dial the database as whoever is logged in.
 * Legacy names are consulted only when no DB_* variable is present at all.
 */
const usingLegacyNames = !process.env.DB_HOST && !process.env.DB_USER && !process.env.DB_NAME;

const credentials = usingLegacyNames
  ? {
      host: process.env.HOST,
      user: process.env.USER,
      password: process.env.PASSWORD,
      database: process.env.DB,
    }
  : {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };

if (!credentials.host || !credentials.user || !credentials.database) {
  console.error(
    'Database configuration is incomplete. Expected DB_HOST/DB_USER/DB_PASSWORD/DB_NAME ' +
      '(or the legacy HOST/USER/PASSWORD/DB) to be set. Every query will fail until they are.',
  );
}

const db = mysql.createPool({
  ...credentials,
  waitForConnections: true,
  connectionLimit: 10,

  /**
   * Return `DATE` columns as `YYYY-MM-DD` strings instead of JS Dates.
   *
   * A DATE is a calendar day, not an instant. The driver was turning it into a
   * Date at local midnight, and `JSON.stringify` then re-emitted that in UTC —
   * so `2026-03-31` left the API as `"2026-03-30T18:30:00.000Z"` and every
   * consumer that reads the date portion of the string saw the day before.
   * A viewer outside IST saw the wrong day everywhere; inside IST the shift
   * cancelled on the way back in, which is why this hid for so long.
   *
   * `modules/project/projectDates.js` already documents this bug and works
   * around it for the projects module. Setting it here fixes it for all 22
   * DATE columns at once, and that helper stays correct because it already
   * accepts a string.
   *
   * Scoped to `DATE` deliberately. `DATETIME`/`TIMESTAMP` are instants and keep
   * returning Date objects; widening this would shift every `created_at` by the
   * session offset.
   */
  dateStrings: ['DATE'],
});

export default db;
