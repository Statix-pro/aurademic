// Opt-in MySQL integration checks for Guest House booking/allocation guards.
// Run only against a fresh, local database named guesthouse_audit_test_*.
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env.development', import.meta.url) });

const dbName = process.env.DB_NAME || '';
const host = String(process.env.DB_HOST || '').toLowerCase();
if (!/^guesthouse_audit_test_[a-z0-9_]+$/.test(dbName)) {
  throw new Error('Set DB_NAME to a dedicated guesthouse_audit_test_* database before running this integration check');
}
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  throw new Error('Guest House MySQL audit integration checks are restricted to a loopback MySQL host');
}

const { default: db } = await import('../config/connection.js');
const { default: guesthouseModel } = await import('../modules/guesthouse/guesthouseModel.js');
const runKey = `audit-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
const bookingIds = [];
const roomIds = [];
const allotmentIds = [];
let assertions = 0;

const assert = (condition, message) => {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
  assertions += 1;
};

const expectConflict = async (promise, message) => {
  try {
    await promise;
  } catch (error) {
    assert(error.statusCode === 409, `${message} returns HTTP 409`);
    return;
  }
  throw new Error(`Assertion failed: ${message} should conflict`);
};

const createBooking = async (label, startDate, startTime, endDate, endTime, stage = 'guesthouse_admin') => {
  const [bookingResult] = await db.query(
    `INSERT INTO guesthouse_bookings
       (applicant_name, request_date, created_by, check_in_date, check_in_time,
        check_out_date, check_out_time, overall_status, workflow_state)
     VALUES (?, CURRENT_DATE(), 900001, ?, ?, ?, ?, 'pending', ?)` ,
    [
      `${runKey}-${label}`,
      startDate,
      startTime,
      endDate,
      endTime,
      JSON.stringify({ currentStage: stage, status: 'in_progress' }),
    ],
  );
  const bookingId = bookingResult.insertId;
  bookingIds.push(bookingId);
  const [guestResult] = await db.query(
    'INSERT INTO guesthouse_guests (booking_id, name) VALUES (?, ?)',
    [bookingId, `${runKey}-guest-${label}`],
  );
  const [allotmentResult] = await db.query(
    'INSERT INTO guesthouse_room_allotments (booking_id, guest_id) VALUES (?, ?)',
    [bookingId, guestResult.insertId],
  );
  allotmentIds.push(allotmentResult.insertId);
  return { bookingId, allotmentId: allotmentResult.insertId };
};

try {
  await db.query(`
    CREATE TABLE IF NOT EXISTS guesthouse_bookings (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      applicant_name VARCHAR(255), request_date DATE NOT NULL,
      created_by INT, check_in_date DATE, check_in_time VARCHAR(20),
      check_out_date DATE, check_out_time VARCHAR(20),
      overall_status VARCHAR(32) DEFAULT 'pending', workflow_state JSON,
      workflow_status VARCHAR(32) GENERATED ALWAYS AS (
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(workflow_state, '$.status')), 'in_progress')
      ) STORED,
      workflow_stage VARCHAR(64) GENERATED ALWAYS AS (
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(workflow_state, '$.currentStage')), '')
      ) STORED,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS guesthouse_guests (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL, name VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS guesthouse_rooms (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      room_type VARCHAR(32) NOT NULL, block VARCHAR(50) NOT NULL,
      room_number VARCHAR(50) NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'Active',
      facilities JSON
    ) ENGINE=InnoDB
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS guesthouse_room_allotments (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL, guest_id INT NOT NULL,
      caretaker_id INT, spoc VARCHAR(255), mobile VARCHAR(20), amenities JSON
    ) ENGINE=InnoDB
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS guesthouse_room_allotment_rows (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      allotment_id INT NOT NULL, room_id INT, room_type VARCHAR(32) NOT NULL,
      block VARCHAR(50), room_number VARCHAR(50), remarks TEXT,
      sort_order INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS guesthouse_room_allotment_row_occupants (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      allotment_row_id INT NOT NULL, occupant_name VARCHAR(255) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB
  `);

  const [roomResult] = await db.query(
    'INSERT INTO guesthouse_rooms (room_type, block, room_number, status) VALUES (?, ?, ?, ?)',
    ['Single', 'AUDIT', runKey, 'Active'],
  );
  const roomId = roomResult.insertId;
  roomIds.push(roomId);

  const reserved = await createBooking('reserved', '2026-12-10', '10:00', '2026-12-10', '11:00');
  const adjacent = await createBooking('adjacent', '2026-12-10', '11:00', '2026-12-10', '12:00');
  await guesthouseModel.addRoomAllotmentRow(reserved.allotmentId, {
    roomId, roomType: 'Single', block: 'AUDIT', roomNumber: runKey,
  });
  await guesthouseModel.addRoomAllotmentRow(adjacent.allotmentId, {
    roomId, roomType: 'Single', block: 'AUDIT', roomNumber: runKey,
  });
  assert(true, 'same-day adjacent stays may use the same room');

  const overlap = await createBooking('overlap', '2026-12-10', '10:30', '2026-12-10', '10:45');
  await expectConflict(
    guesthouseModel.addRoomAllotmentRow(overlap.allotmentId, {
      roomId, roomType: 'Single', block: 'AUDIT', roomNumber: runKey,
    }),
    'same-day overlapping times',
  );

  const options = await guesthouseModel.listGuesthouseRooms({
    status: 'Active', checkInDate: '2026-12-10', checkInTime: '10:30',
    checkOutDate: '2026-12-10', checkOutTime: '10:45',
  });
  assert(options.find((room) => room.id === roomId)?.is_unavailable === 1, 'room options reflect time overlap');

  const virtualCallCount = 200;
  const concurrentBookingPrefix = `${runKey}-concurrent-`;
  const bookingValues = Array.from({ length: virtualCallCount }, (_, index) => [
    `${concurrentBookingPrefix}${index}`,
    '2026-12-11',
    '10:00',
    '2026-12-11',
    '11:00',
    JSON.stringify({ currentStage: 'guesthouse_admin', status: 'in_progress' }),
  ]);
  const bookingPlaceholders = bookingValues.map(() => '(?, CURRENT_DATE(), 900001, ?, ?, ?, ?, \'pending\', ?)').join(', ');
  await db.query(
    `INSERT INTO guesthouse_bookings
       (applicant_name, request_date, created_by, check_in_date, check_in_time,
        check_out_date, check_out_time, overall_status, workflow_state)
     VALUES ${bookingPlaceholders}`,
    bookingValues.flat(),
  );
  await db.query(
    `INSERT INTO guesthouse_guests (booking_id, name)
     SELECT id, CONCAT(?, id) FROM guesthouse_bookings WHERE applicant_name LIKE ?`,
    [`${runKey}-guest-`, `${concurrentBookingPrefix}%`],
  );
  await db.query(
    `INSERT INTO guesthouse_room_allotments (booking_id, guest_id)
     SELECT gb.id, gg.id FROM guesthouse_bookings gb
     INNER JOIN guesthouse_guests gg ON gg.booking_id = gb.id
     WHERE gb.applicant_name LIKE ?`,
    [`${concurrentBookingPrefix}%`],
  );
  const [concurrentAllotments] = await db.query(
    `SELECT gra.id, gb.id AS booking_id FROM guesthouse_room_allotments gra
     INNER JOIN guesthouse_bookings gb ON gb.id = gra.booking_id
     WHERE gb.applicant_name LIKE ? ORDER BY gra.id`,
    [`${concurrentBookingPrefix}%`],
  );
  allotmentIds.push(...concurrentAllotments.map(({ id }) => id));
  bookingIds.push(...concurrentAllotments.map(({ booking_id: bookingId }) => bookingId));
  const concurrentDurations = [];
  const concurrentStartedAt = performance.now();
  const concurrentResults = await Promise.allSettled(concurrentAllotments.map(async ({ id: allotmentId }) => {
    const callStartedAt = performance.now();
    try {
      return await guesthouseModel.addRoomAllotmentRow(allotmentId, {
        roomId, roomType: 'Single', block: 'AUDIT', roomNumber: runKey,
      });
    } finally {
      concurrentDurations.push(performance.now() - callStartedAt);
    }
  }));
  const concurrentElapsedMs = performance.now() - concurrentStartedAt;
  const concurrentSuccesses = concurrentResults.filter((result) => result.status === 'fulfilled').length;
  const concurrentConflicts = concurrentResults.filter(
    (result) => result.status === 'rejected' && result.reason?.statusCode === 409,
  ).length;
  assert(concurrentAllotments.length === virtualCallCount, '200 concurrent allocation fixtures were prepared');
  assert(concurrentSuccesses === 1 && concurrentConflicts === virtualCallCount - 1, '200 simultaneous same-room allocations serialize to one success');
  const [concurrentPersisted] = await db.query(
    `SELECT COUNT(*) AS count FROM guesthouse_room_allotment_rows grar
     INNER JOIN guesthouse_room_allotments gra ON gra.id = grar.allotment_id
     INNER JOIN guesthouse_bookings gb ON gb.id = gra.booking_id
     WHERE gb.applicant_name LIKE ?`,
    [`${concurrentBookingPrefix}%`],
  );
  assert(Number(concurrentPersisted[0].count) === 1, 'only one concurrent allocation persisted');

  const holder = await createBooking('holder', '2026-12-12', '10:00', '2026-12-12', '11:00');
  const moving = await createBooking('moving', '2026-12-13', '10:00', '2026-12-13', '11:00');
  await guesthouseModel.addRoomAllotmentRow(holder.allotmentId, {
    roomId, roomType: 'Single', block: 'AUDIT', roomNumber: runKey,
  });
  await guesthouseModel.addRoomAllotmentRow(moving.allotmentId, {
    roomId, roomType: 'Single', block: 'AUDIT', roomNumber: runKey,
  });
  await expectConflict(
    guesthouseModel.updateGuesthouseTravelSchedule(moving.bookingId, {
      checkInDate: '2026-12-12', checkInTime: '10:30',
      checkOutDate: '2026-12-12', checkOutTime: '10:45',
    }, { expectedWorkflowStage: 'guesthouse_admin', allowedWorkflowStatuses: ['in_progress'] }),
    'travel schedule moved into an allocated room interval',
  );

  const race = await createBooking('workflow-race', '2026-12-14', '10:00', '2026-12-14', '11:00', 'hod');
  const transitionTx = await db.getConnection();
  try {
    await transitionTx.beginTransaction();
    await transitionTx.query('SELECT id FROM guesthouse_bookings WHERE id = ? FOR UPDATE', [race.bookingId]);
    const editPromise = guesthouseModel.updateGuesthouseTravelSchedule(race.bookingId, {
      checkInDate: '2026-12-14', checkInTime: '12:00',
      checkOutDate: '2026-12-14', checkOutTime: '13:00',
    }, { expectedWorkflowStage: 'hod', allowedWorkflowStatuses: ['in_progress'] });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await transitionTx.query(
      'UPDATE guesthouse_bookings SET workflow_state = ? WHERE id = ?',
      [JSON.stringify({ currentStage: 'guesthouse_incharge', status: 'in_progress' }), race.bookingId],
    );
    await transitionTx.commit();
    await expectConflict(editPromise, 'workflow transition racing with a booking schedule edit');
  } catch (error) {
    await transitionTx.rollback();
    throw error;
  } finally {
    transitionTx.release();
  }

  const [remainingRows] = await db.query(
    `SELECT COUNT(*) AS count FROM guesthouse_room_allotment_rows grar
      INNER JOIN guesthouse_room_allotments gra ON gra.id = grar.allotment_id
      WHERE gra.booking_id IN (?)`,
    [bookingIds],
  );
  assert(Number(remainingRows[0].count) === 5, 'only expected successful allocations were saved');
  const percentile = (value) => {
    const ordered = [...concurrentDurations].sort((a, b) => a - b);
    return Math.round(ordered[Math.ceil(value * ordered.length) - 1] || 0);
  };
  console.log(`Guest House MySQL audit integration: ${assertions} assertions passed on isolated database ${dbName}`);
  console.log(`Allocation contention run: ${virtualCallCount} simultaneous backend calls; ${concurrentSuccesses} succeeded, ${concurrentConflicts} returned 409; ${Math.round(concurrentElapsedMs)} ms total; per-call p50/p95/p99 ${percentile(0.5)}/${percentile(0.95)}/${percentile(0.99)} ms.`);
} finally {
  if (bookingIds.length) {
    await db.query('DELETE FROM guesthouse_room_allotment_row_occupants WHERE allotment_row_id IN (SELECT id FROM guesthouse_room_allotment_rows WHERE allotment_id IN (?))', [allotmentIds]);
    await db.query('DELETE FROM guesthouse_room_allotment_rows WHERE allotment_id IN (?)', [allotmentIds]);
    await db.query('DELETE FROM guesthouse_room_allotments WHERE id IN (?)', [allotmentIds]);
    await db.query('DELETE FROM guesthouse_guests WHERE booking_id IN (?)', [bookingIds]);
    await db.query('DELETE FROM guesthouse_bookings WHERE id IN (?)', [bookingIds]);
  }
  if (roomIds.length) await db.query('DELETE FROM guesthouse_rooms WHERE id IN (?)', [roomIds]);
  const [remainingSyntheticRows] = await db.query(
    'SELECT COUNT(*) AS count FROM guesthouse_bookings WHERE applicant_name LIKE ?',
    [`${runKey}%`],
  );
  if (Number(remainingSyntheticRows[0].count) !== 0) {
    console.error('Synthetic Guest House audit records remained after cleanup');
  } else {
    console.log('Synthetic Guest House audit booking rows cleaned: 0 remain.');
  }
  await db.end();
}
