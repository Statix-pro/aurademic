import db from '../../config/connection.js';

// ============================================
// Small shared helpers (same conventions as financeModel.js)
// ============================================

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeText = (value) => String(value ?? '').trim();

const safeParseJSON = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const withTransaction = async (callback, { tx = null } = {}) => {
  if (tx) return callback(tx);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

// Builds one row per calendar day between checkInDate and checkOutDate
// (inclusive of check-in, exclusive of check-out) — mirrors what the
// GuestHouseBooking.tsx UI does client-side when it auto-generates the
// Snacks & Food Requirements rows.
const buildDateRange = (checkInDate, checkOutDate) => {
  const dates = [];
  if (!checkInDate || !checkOutDate) return dates;

  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    return dates;
  }

  const cursor = new Date(start);
  while (cursor < end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const getGuesthouseBookingForUpdate = async (tx, bookingId) => {
  const [rows] = await tx.query(
    `SELECT id, created_by, employee_id, applicant_name, applicant_erp_id, department,
            department_id, designation, email, mobile, check_in_date, check_in_time, check_out_date, check_out_time,
            workflow_state, workflow_status, workflow_stage, overall_status
       FROM guesthouse_bookings WHERE id = ? FOR UPDATE`,
    [toPositiveInt(bookingId)],
  );
  if (!rows.length) return null;
  return { ...rows[0], workflow_state: safeParseJSON(rows[0].workflow_state, null) };
};

const getWorkflowStageAndStatus = (booking) => ({
  stage: normalizeText(booking?.workflow_state?.currentStage || booking?.workflow_stage).toLowerCase(),
  status: normalizeText(booking?.workflow_state?.status || booking?.workflow_status || booking?.overall_status).toLowerCase(),
});

const assertWorkflowState = (booking, { expectedWorkflowStage, allowedWorkflowStatuses, conflictMessage } = {}) => {
  const current = getWorkflowStageAndStatus(booking);
  if (
    expectedWorkflowStage != null && current.stage !== normalizeText(expectedWorkflowStage).toLowerCase()
  ) {
    const error = new Error(conflictMessage || 'Guest House request changed workflow stage; reload and try again');
    error.statusCode = 409;
    throw error;
  }
  if (Array.isArray(allowedWorkflowStatuses) && !allowedWorkflowStatuses.includes(current.status)) {
    const error = new Error(conflictMessage || 'Guest House request is no longer editable in its current workflow stage');
    error.statusCode = 409;
    throw error;
  }
  return current;
};

const assertRoomAllocationActionable = async (tx, bookingId) => {
  const booking = await getGuesthouseBookingForUpdate(tx, bookingId);
  if (!booking) {
    const error = new Error('Guest house booking not found');
    error.statusCode = 404;
    throw error;
  }
  const { stage, status } = getWorkflowStageAndStatus(booking);
  if (stage !== 'guesthouse_admin' || !['in_progress', 'returned'].includes(status)) {
    const error = new Error('Room allocation is not available at this workflow stage');
    error.statusCode = 409;
    throw error;
  }
  return booking;
};

const assertRoomAvailable = async (tx, {
  bookingId,
  roomId,
  block,
  roomNumber,
  checkInDate,
  checkInTime,
  checkOutDate,
  checkOutTime,
  excludeBookingId = bookingId,
  requireActive = true,
}) => {
  const normalizedRoomId = toPositiveInt(roomId);
  const [roomRows] = await tx.query(
    normalizedRoomId
      ? `SELECT id FROM guesthouse_rooms WHERE id = ?${requireActive ? " AND status = 'Active'" : ''} FOR UPDATE`
      : `SELECT id FROM guesthouse_rooms WHERE block = ? AND room_number = ?${requireActive ? " AND status = 'Active'" : ''} FOR UPDATE`,
    normalizedRoomId ? [normalizedRoomId] : [normalizeText(block), normalizeText(roomNumber)],
  );
  if (!roomRows.length && requireActive) {
    const error = new Error('Selected room is unavailable');
    error.statusCode = 409;
    throw error;
  }
  const lockedRoomId = roomRows.length ? Number(roomRows[0].id) : normalizedRoomId;
  const roomFilter = '(grar.room_id = ? OR (grar.room_id IS NULL AND grar.block = ? AND grar.room_number = ?))';
  const roomParams = [lockedRoomId, normalizeText(block), normalizeText(roomNumber)];
  const [conflicts] = await tx.query(
    `SELECT gb.id FROM guesthouse_room_allotment_rows grar
     INNER JOIN guesthouse_room_allotments gra ON gra.id = grar.allotment_id
     INNER JOIN guesthouse_bookings gb ON gb.id = gra.booking_id
     WHERE ${roomFilter} AND gb.id <> ?
       AND gb.overall_status NOT IN ('rejected', 'archived')
       AND CAST(CONCAT(gb.check_in_date, ' ', COALESCE(NULLIF(gb.check_in_time, ''), '00:00:00')) AS DATETIME)
           < CAST(CONCAT(?, ' ', COALESCE(NULLIF(?, ''), '23:59:59')) AS DATETIME)
       AND CAST(CONCAT(gb.check_out_date, ' ', COALESCE(NULLIF(gb.check_out_time, ''), '00:00:00')) AS DATETIME)
           > CAST(CONCAT(?, ' ', COALESCE(NULLIF(?, ''), '00:00:00')) AS DATETIME)
     LIMIT 1 FOR UPDATE`,
    [
      ...roomParams,
      excludeBookingId,
      checkOutDate,
      checkOutTime,
      checkInDate,
      checkInTime,
    ],
  );
  if (conflicts.length) {
    const error = new Error('Selected room is already allotted for an overlapping stay');
    error.statusCode = 409;
    throw error;
  }
  return lockedRoomId;
};

const guesthouseModel = {
  async getActiveEmployeeIdByEmail(email) {
    const normalizedEmail = normalizeText(email).toLowerCase();
    if (!normalizedEmail) return null;
      const [rows] = await db.execute(
      `SELECT id FROM master_employees
        WHERE LOWER(TRIM(email)) = ? AND status = 'Active'
        ORDER BY id ASC LIMIT 1`,
      [normalizedEmail],
    );
    return toPositiveInt(rows[0]?.id);
  },

  async beginTransaction() {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      return conn;
    } catch (error) {
      conn.release();
      throw error;
    }
  },
  // ============================================
  // Bookings — core CRUD
  // ============================================

  async createGuesthouseBooking(payload = {}, createdByUserId, options = {}) {
    return withTransaction(async (tx) => {
      const applicant = payload.applicant || {};
      const beneficiary = payload.beneficiary || {};
      const requestedEmployeeId = toPositiveInt(applicant.employeeId);
      let employeeId = null;
      let employeeProfile = null;

      if (requestedEmployeeId) {
        const [employeeRows] = await tx.query(
          `SELECT e.id, e.erp_id, CONCAT(COALESCE(e.title, ''), ' ', e.first_name, ' ', COALESCE(e.last_name, '')) AS full_name,
                  e.designation, e.email, e.mobile, d.name AS department, e.department_id
             FROM master_employees e LEFT JOIN master_departments d ON d.id = e.department_id
            WHERE e.id = ? AND e.status = 'Active' LIMIT 1`,
          [requestedEmployeeId],
        );
        if (employeeRows.length) {
          employeeId = requestedEmployeeId;
          employeeProfile = employeeRows[0];
        } else {
          const error = new Error('Applicant employee profile is unavailable');
          error.statusCode = 403;
          throw error;
        }
      }
      const beneficiaryType = normalizeText(beneficiary.beneficiaryType);
      const beneficiaryDepartmentName =
        beneficiaryType.toLowerCase() === 'department'
          ? normalizeText(beneficiary.staffName)
          : normalizeText(beneficiary.department);
      const requestedDepartmentId = beneficiaryType.toLowerCase() === 'department'
        ? toPositiveInt(beneficiary.departmentId)
        : toPositiveInt(employeeProfile?.department_id) || toPositiveInt(applicant.departmentId);
      if (beneficiaryType.toLowerCase() === 'department' && !requestedDepartmentId) {
        const error = new Error('Select a valid department before submitting this request');
        error.statusCode = 400;
        throw error;
      }
      let departmentRows = [];
      if (requestedDepartmentId) {
        [departmentRows] = await tx.query(
          `SELECT id, name FROM master_departments WHERE id = ? AND is_active = 1 LIMIT 1`,
          [requestedDepartmentId],
        );
        if (!departmentRows.length) {
          const error = new Error('Selected department is invalid or inactive');
          error.statusCode = 400;
          throw error;
        }
      }
      const workflowDepartmentId = toPositiveInt(departmentRows[0]?.id);
      const workflowDepartmentName = normalizeText(departmentRows[0]?.name) ||
        beneficiaryDepartmentName || normalizeText(applicant.department) || null;
      const guests = Array.isArray(payload.guests) ? payload.guests : [];
      const datedGuests = guests.filter((guest) => guest?.travel?.checkInDate && guest?.travel?.checkOutDate);
      const firstStay = [...datedGuests].sort((a, b) =>
        `${a.travel.checkInDate}T${a.travel.checkInTime || '00:00'}`.localeCompare(`${b.travel.checkInDate}T${b.travel.checkInTime || '00:00'}`),
      )[0];
      const lastStay = [...datedGuests].sort((a, b) =>
        `${b.travel.checkOutDate}T${b.travel.checkOutTime || '00:00'}`.localeCompare(`${a.travel.checkOutDate}T${a.travel.checkOutTime || '00:00'}`),
      )[0];
      const overallCheckIn = firstStay?.travel?.checkInDate || null;
      const overallCheckOut = lastStay?.travel?.checkOutDate || null;

      const [result] = await tx.query(
        `INSERT INTO guesthouse_bookings (
           employee_id, applicant_name, applicant_erp_id, department, department_id,
           designation, email, mobile, request_date,
           beneficiary_type, beneficiary_value, budget_tag,
           check_in_date, check_in_time, check_out_date, check_out_time,
           number_of_days, duration_label, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          employeeId,
          normalizeText(employeeProfile?.full_name || applicant.name) || null,
          employeeProfile?.erp_id || (employeeId ? null : normalizeText(applicant.erpId || applicant.erp_id) || null),
          workflowDepartmentName,
          workflowDepartmentId,
          normalizeText(employeeProfile?.designation || applicant.designation) || null,
          normalizeText(employeeProfile?.email || applicant.email) || null,
          normalizeText(employeeProfile?.mobile || applicant.mobile) || null,
          applicant.date || new Date().toISOString().slice(0, 10),
          normalizeText(beneficiary.beneficiaryType) || null,
          normalizeText(beneficiary.staffName) || null,
          normalizeText(beneficiary.tag) || null,
          overallCheckIn,
          normalizeText(firstStay?.travel?.checkInTime) || null,
          overallCheckOut,
          normalizeText(lastStay?.travel?.checkOutTime) || null,
          toPositiveInt(payload.numberOfDays),
          normalizeText(payload.duration) || null,
          toPositiveInt(createdByUserId),
        ],
      );

      const bookingId = result.insertId;

      // Guests + their room requests (1 row per guest, N rows per guest for room types)
      for (let index = 0; index < guests.length; index += 1) {
        const guest = guests[index];
        const [guestResult] = await tx.query(
          `INSERT INTO guesthouse_guests (
             booking_id, name, gender, priority, designation, email, organization,
             city, state, accompanied_male, accompanied_female, accompanied_children,
             food_veg, food_nonveg, remarks, sort_order
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            bookingId,
            normalizeText(guest.name),
            normalizeText(guest.gender) || null,
            normalizeText(guest.priority) || 'Routine',
            normalizeText(guest.designation) || null,
            normalizeText(guest.email) || null,
            normalizeText(guest.organization) || null,
            normalizeText(guest.city) || null,
            normalizeText(guest.state) || null,
            Number(guest.accompaniedMale) || 0,
            Number(guest.accompaniedFemale) || 0,
            Number(guest.accompaniedChildren) || 0,
            Number(guest.foodVeg) || 0,
            Number(guest.foodNonVeg || guest.foodNonveg) || 0,
            normalizeText(guest.remarks) || null,
            index,
          ],
        );

        const guestId = guestResult.insertId;

        // Parse/map guest room requirements dynamically
        const reqTypes = [
          { type: 'Single', count: Number(guest.roomSingle) || 0 },
          { type: 'Double', count: Number(guest.roomDouble) || 0 },
          { type: 'Deluxe', count: Number(guest.roomDeluxe) || 0 },
        ];
        for (const req of reqTypes) {
          if (req.count > 0) {
            await tx.query(
              `INSERT INTO guesthouse_guest_room_requests (guest_id, room_type, requested_count)
               VALUES (?, ?, ?)`,
              [guestId, req.type, req.count],
            );
          }
        }
      }

      // Map and store custom guest food and snacks selections (save actual veg/non-veg counts)
      const foodRequirements = Array.isArray(payload.foodRequirements) ? payload.foodRequirements : [];
      if (foodRequirements.length > 0) {
        for (const req of foodRequirements) {
          if (!req.date) continue;
          await tx.query(
            `INSERT INTO guesthouse_food_requirements (
               booking_id, req_date, morning_refreshment,
               breakfast_veg, breakfast_nonveg,
               lunch_veg, lunch_nonveg,
               evening_refreshment,
               dinner_veg, dinner_nonveg
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               morning_refreshment = VALUES(morning_refreshment),
               breakfast_veg = VALUES(breakfast_veg),
               breakfast_nonveg = VALUES(breakfast_nonveg),
               lunch_veg = VALUES(lunch_veg),
               lunch_nonveg = VALUES(lunch_nonveg),
               evening_refreshment = VALUES(evening_refreshment),
               dinner_veg = VALUES(dinner_veg),
               dinner_nonveg = VALUES(dinner_nonveg)`,
            [
              bookingId,
              req.date,
              Number(req.morningRefreshment) || 0,
              Number(req.breakfastVeg) || 0,
              Number(req.breakfastNonVeg || req.breakfastNonveg) || 0,
              Number(req.lunchVeg) || 0,
              Number(req.lunchNonVeg || req.lunchNonveg) || 0,
              Number(req.eveningRefreshment) || 0,
              Number(req.dinnerVeg) || 0,
              Number(req.dinnerNonVeg || req.dinnerNonveg) || 0,
            ],
          );
        }
      } else {
        // Fallback: Auto-generate empty rows based on stay window
        const dates = buildDateRange(overallCheckIn, overallCheckOut);
        for (const reqDate of dates) {
          await tx.query(
            `INSERT INTO guesthouse_food_requirements (booking_id, req_date)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE req_date = req_date`,
            [bookingId, reqDate],
          );
        }
      }

      return bookingId;
    }, options);
  },

  /** Replace the editable booking detail rows in one transaction. Workflow data is retained. */
  async updateGuesthouseBooking(bookingId, payload = {}, workflowGuard = {}) {
    const normalizedId = toPositiveInt(bookingId);
    if (!normalizedId) return false;

    return withTransaction(async (tx) => {
      const currentBooking = await getGuesthouseBookingForUpdate(tx, normalizedId);
      if (!currentBooking) return false;
      assertWorkflowState(currentBooking, {
        ...workflowGuard,
        conflictMessage: 'This booking can only be edited while it remains active in the current workflow stage',
      });

      const applicant = payload.applicant || {};
      const beneficiary = payload.beneficiary || {};
      const beneficiaryType = normalizeText(beneficiary.beneficiaryType);
      const guests = Array.isArray(payload.guests) ? payload.guests : [];
      const datedGuests = guests.filter((guest) => guest?.travel?.checkInDate && guest?.travel?.checkOutDate);
      const firstStay = [...datedGuests].sort((a, b) =>
        `${a.travel.checkInDate}T${a.travel.checkInTime || '00:00'}`.localeCompare(`${b.travel.checkInDate}T${b.travel.checkInTime || '00:00'}`),
      )[0];
      const lastStay = [...datedGuests].sort((a, b) =>
        `${b.travel.checkOutDate}T${b.travel.checkOutTime || '00:00'}`.localeCompare(`${a.travel.checkOutDate}T${a.travel.checkOutTime || '00:00'}`),
      )[0];
      // Department scope is fixed when the request is created. Editing form
      // fields must not silently clear or redirect the HOD queue assignment.
      let workflowDepartmentName = normalizeText(currentBooking.department) || null;
      let workflowDepartmentId = toPositiveInt(currentBooking.department_id);
      if (!workflowDepartmentId && workflowDepartmentName) {
        const [departmentRows] = await tx.query(
          `SELECT id, name FROM master_departments
            WHERE is_active = 1 AND LOWER(TRIM(name)) = LOWER(TRIM(?))
            ORDER BY id ASC LIMIT 1`,
          [workflowDepartmentName],
        );
        if (departmentRows.length) {
          workflowDepartmentId = toPositiveInt(departmentRows[0].id);
          workflowDepartmentName = normalizeText(departmentRows[0].name);
        }
      }

      // A guest with an allocation must not be replaced: its allocation references that guest id.
      const [allocated] = await tx.query(
        `SELECT 1 FROM guesthouse_room_allotments WHERE booking_id = ? LIMIT 1`,
        [normalizedId],
      );
      if (allocated.length) {
        const error = new Error('This booking already has room allocations and cannot be edited.');
        error.statusCode = 409;
        throw error;
      }

      const [updated] = await tx.query(
        `UPDATE guesthouse_bookings SET
           applicant_name = ?, applicant_erp_id = ?, department = ?, department_id = ?,
           designation = ?, email = ?, mobile = ?, request_date = ?,
           beneficiary_type = ?, beneficiary_value = ?, budget_tag = ?,
           check_in_date = ?, check_in_time = ?, check_out_date = ?, check_out_time = ?,
           number_of_days = ?, duration_label = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          normalizeText(currentBooking.applicant_name) || null,
          normalizeText(currentBooking.applicant_erp_id) || null,
          workflowDepartmentName,
          workflowDepartmentId,
          normalizeText(currentBooking.designation) || null,
          normalizeText(currentBooking.email) || null,
          normalizeText(currentBooking.mobile) || null,
          applicant.date || new Date().toISOString().slice(0, 10),
          beneficiaryType || null,
          normalizeText(beneficiary.staffName) || null,
          normalizeText(beneficiary.tag) || null,
          firstStay?.travel?.checkInDate || null,
          normalizeText(firstStay?.travel?.checkInTime) || null,
          lastStay?.travel?.checkOutDate || null,
          normalizeText(lastStay?.travel?.checkOutTime) || null,
          toPositiveInt(payload.numberOfDays),
          normalizeText(payload.duration) || null,
          normalizedId,
        ],
      );
      if (!updated.affectedRows) return false;

      await tx.query(
        `DELETE grr FROM guesthouse_guest_room_requests grr
         INNER JOIN guesthouse_guests gg ON gg.id = grr.guest_id WHERE gg.booking_id = ?`,
        [normalizedId],
      );
      await tx.query('DELETE FROM guesthouse_guests WHERE booking_id = ?', [normalizedId]);
      await tx.query('DELETE FROM guesthouse_food_requirements WHERE booking_id = ?', [normalizedId]);

      for (let index = 0; index < guests.length; index += 1) {
        const guest = guests[index];
        const [guestResult] = await tx.query(
          `INSERT INTO guesthouse_guests (booking_id, name, gender, priority, designation, email, organization,
             city, state, accompanied_male, accompanied_female, accompanied_children, food_veg, food_nonveg, remarks, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [normalizedId, normalizeText(guest.name), normalizeText(guest.gender) || null,
            normalizeText(guest.priority) || 'Routine', normalizeText(guest.designation) || null,
            normalizeText(guest.email) || null, normalizeText(guest.organization) || null,
            normalizeText(guest.city) || null, normalizeText(guest.state) || null,
            Number(guest.accompaniedMale) || 0, Number(guest.accompaniedFemale) || 0,
            Number(guest.accompaniedChildren) || 0, Number(guest.foodVeg) || 0,
            Number(guest.foodNonVeg || guest.foodNonveg) || 0, normalizeText(guest.remarks) || null, index],
        );
        for (const req of [
          ['Single', Number(guest.roomSingle) || 0], ['Double', Number(guest.roomDouble) || 0], ['Deluxe', Number(guest.roomDeluxe) || 0],
        ]) {
          if (req[1] > 0) await tx.query(
            'INSERT INTO guesthouse_guest_room_requests (guest_id, room_type, requested_count) VALUES (?, ?, ?)',
            [guestResult.insertId, req[0], req[1]],
          );
        }
      }

      const foodRequirements = Array.isArray(payload.foodRequirements) ? payload.foodRequirements : [];
      for (const req of foodRequirements) {
        if (!req.date) continue;
        await tx.query(
          `INSERT INTO guesthouse_food_requirements (booking_id, req_date, morning_refreshment, breakfast_veg, breakfast_nonveg,
             lunch_veg, lunch_nonveg, evening_refreshment, dinner_veg, dinner_nonveg)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE morning_refreshment = VALUES(morning_refreshment),
             breakfast_veg = VALUES(breakfast_veg), breakfast_nonveg = VALUES(breakfast_nonveg),
             lunch_veg = VALUES(lunch_veg), lunch_nonveg = VALUES(lunch_nonveg),
             evening_refreshment = VALUES(evening_refreshment), dinner_veg = VALUES(dinner_veg),
             dinner_nonveg = VALUES(dinner_nonveg)`,
          [normalizedId, req.date, Number(req.morningRefreshment) || 0, Number(req.breakfastVeg) || 0,
            Number(req.breakfastNonVeg || req.breakfastNonveg) || 0, Number(req.lunchVeg) || 0,
            Number(req.lunchNonVeg || req.lunchNonveg) || 0, Number(req.eveningRefreshment) || 0,
            Number(req.dinnerVeg) || 0, Number(req.dinnerNonVeg || req.dinnerNonveg) || 0],
        );
      }
      return true;
    }, { tx: workflowGuard.tx || null });
  },

  async getGuesthouseBookingById(bookingId) {
    const normalizedId = toPositiveInt(bookingId);
    if (!normalizedId) return null;

    // The view intentionally contains presentation fields only; get the raw
    // workflow JSON from the source table so workflow consumers receive it.
    const [rows] = await db.query(`SELECT vgb.*, gb.department_id, gb.created_by,
      gb.workflow_state, gb.principal_document
      FROM v_guesthouse_bookings vgb
      INNER JOIN guesthouse_bookings gb ON gb.id = vgb.id
      WHERE vgb.id = ?`, [
      normalizedId,
    ]);
    if (!rows.length) return null;

    const booking = rows[0];
    booking.workflow_state = safeParseJSON(booking.workflow_state, null);
    booking.principal_document = safeParseJSON(booking.principal_document, null);

    const [[guests], [foodRows], [allotments]] = await Promise.all([
      db.query(`SELECT * FROM guesthouse_guests WHERE booking_id = ? ORDER BY sort_order ASC, id ASC`, [normalizedId]),
      db.query(`SELECT * FROM guesthouse_food_requirements WHERE booking_id = ? ORDER BY req_date ASC`, [normalizedId]),
      db.query(`SELECT * FROM guesthouse_room_allotments WHERE booking_id = ?`, [normalizedId]),
    ]);

    const guestIds = guests.map((g) => g.id);
    let roomRequestsByGuest = new Map();
    if (guestIds.length) {
      const [roomRequests] = await db.query(
        `SELECT * FROM guesthouse_guest_room_requests WHERE guest_id IN (?)`,
        [guestIds],
      );
      roomRequestsByGuest = roomRequests.reduce((map, row) => {
        const list = map.get(row.guest_id) || [];
        list.push(row);
        map.set(row.guest_id, list);
        return map;
      }, new Map());
    }

    booking.guests = guests.map((guest) => ({
      ...guest,
      roomRequests: roomRequestsByGuest.get(guest.id) || [],
    }));

    booking.foodRequirements = foodRows;
    const allotmentIds = allotments.map((a) => a.id);
    let rowsByAllotment = new Map();
    if (allotmentIds.length) {
      const [allotmentRows] = await db.query(
        `SELECT * FROM guesthouse_room_allotment_rows WHERE allotment_id IN (?) ORDER BY sort_order ASC, id ASC`,
        [allotmentIds],
      );
      const rowIds = allotmentRows.map((r) => r.id);
      let occupantsByRow = new Map();
      if (rowIds.length) {
        const [occupants] = await db.query(
          `SELECT * FROM guesthouse_room_allotment_row_occupants WHERE allotment_row_id IN (?) ORDER BY sort_order ASC, id ASC`,
          [rowIds],
        );
        occupantsByRow = occupants.reduce((map, occ) => {
          const list = map.get(occ.allotment_row_id) || [];
          list.push(occ);
          map.set(occ.allotment_row_id, list);
          return map;
        }, new Map());
      }
      rowsByAllotment = allotmentRows.reduce((map, row) => {
        const list = map.get(row.allotment_id) || [];
        list.push({ ...row, occupants: occupantsByRow.get(row.id) || [] });
        map.set(row.allotment_id, list);
        return map;
      }, new Map());
    }
    booking.roomAllotments = allotments.map((allotment) => ({
      ...allotment,
      amenities: safeParseJSON(allotment.amenities, null),
      rooms: rowsByAllotment.get(allotment.id) || [],
    }));

    return booking;
  },

  async listGuesthouseBookings({ createdByUserId, bookingIds, search, page = 1, limit = 20 } = {}) {
    const whereParts = [];
    const whereParams = [];

    if (createdByUserId) {
      whereParts.push('gb.created_by = ?');
      whereParams.push(toPositiveInt(createdByUserId));
    }
    if (Array.isArray(bookingIds)) {
      const normalizedIds = [...new Set(bookingIds.map(toPositiveInt).filter(Boolean))];
      const safePage = Math.max(Number.parseInt(page, 10) || 1, 1);
      const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
      if (!normalizedIds.length) return { items: [], total: 0, page: safePage, limit: safeLimit };
      whereParts.push('gb.id IN (?)');
      whereParams.push(normalizedIds);
    }
    if (search) {
      whereParts.push(
        `(LOWER(COALESCE(gb.applicant_name, '')) LIKE LOWER(?) OR LOWER(COALESCE(gb.department, '')) LIKE LOWER(?))`,
      );
      const likeTerm = `%${normalizeText(search)}%`;
      whereParams.push(likeTerm, likeTerm);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const safePage = Math.max(Number.parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
    const offset = (safePage - 1) * safeLimit;

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM guesthouse_bookings gb ${whereClause}`,
      whereParams,
    );

    const [rows] = await db.query(
       `SELECT gb.*,
              (SELECT GROUP_CONCAT(gg.name ORDER BY gg.sort_order ASC, gg.id ASC SEPARATOR ', ')
               FROM guesthouse_guests gg WHERE gg.booking_id = gb.id) AS guest_details,
              EXISTS(
                SELECT 1
                FROM guesthouse_room_allotments gra
                INNER JOIN guesthouse_room_allotment_rows grar ON grar.allotment_id = gra.id
                WHERE gra.booking_id = gb.id
                  AND NULLIF(TRIM(grar.room_number), '') IS NOT NULL
              ) AS has_room_allocation,
              (SELECT COUNT(*)
               FROM guesthouse_room_allotments gra
               INNER JOIN guesthouse_room_allotment_rows grar ON grar.allotment_id = gra.id
               WHERE gra.booking_id = gb.id
                 AND NULLIF(TRIM(grar.room_number), '') IS NOT NULL
              ) AS allocated_room_count
       FROM guesthouse_bookings gb
       ${whereClause}
       ORDER BY gb.created_at DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, safeLimit, offset],
    );

    const parsedRows = rows.map((row) => ({
      ...row,
      workflow_state: safeParseJSON(row.workflow_state, null),
      principal_document: safeParseJSON(row.principal_document, null),
    }));

    return {
      items: parsedRows,
      total: Number(countRows?.[0]?.total || 0),
      page: safePage,
      limit: safeLimit,
    };
  },

  async listAccessibleGuesthouseBookingIds(stageFilters = []) {
    const usableFilters = stageFilters.filter(({ stage, filters }) =>
      normalizeText(stage) && !filters?.forceEmpty && !(filters?.forceAll === false &&
        normalizeText(filters?.scopeType).toLowerCase() === 'department' &&
        !Array.from(filters?.departmentIds || []).some((id) => toPositiveInt(id))));
    if (!usableFilters.length) return [];
    const clauses = [];
    const params = [];
    for (const { stage, filters = {} } of usableFilters) {
      const normalizedStage = normalizeText(stage).toLowerCase();
      const departmentIds = Array.from(filters.departmentIds || [])
        .map((id) => toPositiveInt(id))
        .filter(Boolean);
      const scopeClause = !filters.forceAll && normalizeText(filters.scopeType).toLowerCase() === 'department'
        ? ` AND gb.department_id IN (${departmentIds.map(() => '?').join(',')})`
        : '';
      if (scopeClause && !departmentIds.length) continue;
      clauses.push(`((COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(gb.workflow_state, '$.currentStage')), 'null'), NULLIF(TRIM(gb.workflow_stage), ''), 'hod') = ?
        OR EXISTS (
          SELECT 1 FROM workflow_actions wa
          INNER JOIN (SELECT record_id, stage, MAX(id) AS latest_id
                        FROM workflow_actions WHERE module_key = 'guesthouse'
                        GROUP BY record_id, stage) latest ON latest.latest_id = wa.id
          WHERE wa.module_key = 'guesthouse' AND wa.record_id = gb.id
            AND wa.stage COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
            AND wa.decision <> 'resubmitted'
        ))${scopeClause})`);
      params.push(normalizedStage, normalizedStage);
      if (scopeClause) params.push(...departmentIds);
    }
    if (!clauses.length) return [];
    const [rows] = await db.query(
      `SELECT DISTINCT gb.id FROM guesthouse_bookings gb WHERE ${clauses.join(' OR ')}`,
      params,
    );
    return rows.map((row) => toPositiveInt(row.id)).filter(Boolean);
  },

  async getGuesthouseOwner(bookingId) {
    const normalizedId = toPositiveInt(bookingId);
    if (!normalizedId) return null;
    const [rows] = await db.query(`SELECT created_by FROM guesthouse_bookings WHERE id = ?`, [
      normalizedId,
    ]);
    return rows[0] || null;
  },

  async deleteGuesthouseBooking(bookingId, { expectedOwnerId, allowSuperAdmin = false } = {}) {
    const normalizedId = toPositiveInt(bookingId);
    if (!normalizedId) return false;
    return withTransaction(async (tx) => {
      const booking = await getGuesthouseBookingForUpdate(tx, normalizedId);
      if (!booking) return false;

      if (!allowSuperAdmin) {
        const ownerId = toPositiveInt(booking.created_by);
        const actorId = toPositiveInt(expectedOwnerId);
        if (!ownerId || !actorId || ownerId !== actorId) {
          const error = new Error('Insufficient permissions');
          error.statusCode = 403;
          throw error;
        }
        const { stage, status } = getWorkflowStageAndStatus(booking);
        if ((stage && stage !== 'hod') || ['approved', 'rejected', 'archived', 'completed'].includes(status)) {
          const error = new Error('This booking can no longer be deleted after approval has started');
          error.statusCode = 409;
          throw error;
        }
      }

      const [result] = await tx.query('DELETE FROM guesthouse_bookings WHERE id = ?', [normalizedId]);
      return result.affectedRows > 0;
    });
  },

  // ============================================
  // Workflow adapter contract — required by
  // ../shared/workflow/workflowModuleRegistry.js
  // ============================================

  async getGuesthouseRecordContext(recordId, { tx = db, forUpdate = false } = {}) {
    const normalizedRecordId = toPositiveInt(recordId);
    if (!normalizedRecordId) return null;

    const lockClause = forUpdate ? ' FOR UPDATE' : '';
    const [rows] = await tx.query(
      `SELECT
          gb.id,
          gb.created_by,
          gb.beneficiary_type,
          gb.department_id
         FROM guesthouse_bookings gb
        WHERE gb.id = ?${lockClause}`,
      [normalizedRecordId],
    );
    if (!rows.length) return null;

    const row = rows[0];
    return {
      beneficiaryType: normalizeText(row.beneficiary_type) || null,
      departmentId: toPositiveInt(row.department_id),
      applicantUserId: toPositiveInt(row.created_by),
    };
  },

  async updateGuesthouseWorkflowSnapshot(recordId, newState, { tx = db } = {}) {
    const normalizedRecordId = toPositiveInt(recordId);
    if (!normalizedRecordId) return false;

    const status = normalizeText(newState?.status).toLowerCase();
    const overallStatus =
      status === 'completed'
        ? 'approved'
        : status === 'rejected'
          ? 'rejected'
          : status === 'archived'
            ? 'archived'
            : 'pending';

    const [result] = await tx.query(
      `UPDATE guesthouse_bookings
          SET workflow_state = ?, overall_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [JSON.stringify(newState || null), overallStatus, normalizedRecordId],
    );
    return result.affectedRows > 0;
  },

  async canAccessGuesthouseBookingInQueue(recordId, stage, scopeFilters = {}) {
    const normalizedId = toPositiveInt(recordId);
    const normalizedStage = normalizeText(stage).toLowerCase();
    if (!normalizedId || !normalizedStage) return false;

    const whereParts = [
      'gb.id = ?',
      `(COALESCE(
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(gb.workflow_state, '$.currentStage')), 'null'),
        NULLIF(TRIM(gb.workflow_stage), ''),
        'hod'
      ) = ? OR stage_action.id IS NOT NULL)`,
    ];
    const params = [normalizedId, normalizedStage];
    const scopeType = normalizeText(scopeFilters.scopeType).toLowerCase();

    if (!scopeFilters.forceAll && scopeType === 'department') {
      const departmentIds = Array.from(scopeFilters.departmentIds || [])
        .map((id) => toPositiveInt(id))
        .filter(Boolean);
      if (scopeFilters.forceEmpty || departmentIds.length === 0) return false;

      whereParts.push('gb.department_id IN (?)');
      params.push(departmentIds);
    }

    const [rows] = await db.query(
      `SELECT gb.id
         FROM guesthouse_bookings gb
         LEFT JOIN (
           SELECT wa.record_id, wa.stage, wa.id
             FROM workflow_actions wa
             INNER JOIN (
               SELECT record_id, stage, MAX(id) AS latest_id
                 FROM workflow_actions
                WHERE module_key = 'guesthouse'
                GROUP BY record_id, stage
             ) latest ON latest.latest_id = wa.id
         ) stage_action
           ON stage_action.record_id = gb.id
          AND stage_action.stage COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
        WHERE ${whereParts.join(' AND ')}`,
      [normalizedStage, ...params],
    );

    return rows.length > 0;
  },

  async listGuesthouseQueueRecords(stage, filters = {}, { tx = db } = {}) {
    const normalizedStage = normalizeText(stage).toLowerCase();
    const workflowStatus = normalizeText(filters.workflowStatus).toLowerCase() || 'in_progress';
    const searchTerm = normalizeText(filters.q || filters.search);
    const page = Math.max(Number.parseInt(filters.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(filters.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const stageActionJoin = `LEFT JOIN (
      SELECT wa.record_id, wa.stage, wa.decision, wa.id
        FROM workflow_actions wa
        INNER JOIN (
          SELECT record_id, stage, MAX(id) AS latest_id
            FROM workflow_actions
           WHERE module_key = 'guesthouse'
           GROUP BY record_id, stage
        ) latest ON latest.latest_id = wa.id
    ) stage_action
      ON stage_action.record_id = gb.id
     AND stage_action.stage COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci`;
    const whereParts = [
      `(COALESCE(
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(gb.workflow_state, '$.currentStage')), 'null'),
        NULLIF(TRIM(gb.workflow_stage), ''),
        'hod'
      ) = ? OR stage_action.id IS NOT NULL)`,
    ];
    const whereParams = [normalizedStage];

    if (workflowStatus !== 'all') {
      whereParts.push(`CASE
        WHEN COALESCE(
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(gb.workflow_state, '$.status')), 'null'),
          NULLIF(TRIM(gb.workflow_status), ''),
          'in_progress'
        ) IN ('pending', 'submitted') THEN 'in_progress'
        ELSE COALESCE(
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(gb.workflow_state, '$.status')), 'null'),
          NULLIF(TRIM(gb.workflow_status), ''),
          'in_progress'
        )
      END = ?`);
      whereParams.push(workflowStatus);
    }

    const unscopedWhereParts = [...whereParts];
    const unscopedWhereParams = [...whereParams];

    const scopeFilters = filters.scopeFilters || {};
    if (!scopeFilters.forceAll && scopeFilters.scopeType === 'department') {
      const departmentIds = Array.from(scopeFilters.departmentIds || [])
        .map((id) => toPositiveInt(id))
        .filter(Boolean);
      if (scopeFilters.forceEmpty || departmentIds.length === 0) {
        return { items: [], total: 0, page, limit };
      }
      whereParts.push('gb.department_id IN (?)');
      whereParams.push(departmentIds);
    }

    if (searchTerm) {
      whereParts.push(
        `(LOWER(COALESCE(gb.applicant_name, '')) LIKE LOWER(?) OR LOWER(COALESCE(gb.department, '')) LIKE LOWER(?))`,
      );
      const likeTerm = `%${searchTerm}%`;
      whereParams.push(likeTerm, likeTerm);
      unscopedWhereParams.push(likeTerm, likeTerm);
    }

    const whereClause = `WHERE ${whereParts.join(' AND ')}`;

    const [countRows] = await tx.query(
      `SELECT COUNT(*) AS total
         FROM guesthouse_bookings gb
       ${stageActionJoin}
       ${whereClause}`,
      [normalizedStage, ...whereParams],
    );

    let scopeWarning;
    if (
      Number(countRows?.[0]?.total || 0) === 0 &&
      !scopeFilters.forceAll &&
      scopeFilters.scopeType === 'department' &&
      Array.from(scopeFilters.departmentIds || []).length > 0
    ) {
      const [unscopedRows] = await tx.query(
        `SELECT COUNT(*) AS total
         FROM guesthouse_bookings gb
         ${stageActionJoin}
         WHERE ${unscopedWhereParts.join(' AND ')}`,
        [normalizedStage, ...unscopedWhereParams],
      );
      if (Number(unscopedRows?.[0]?.total || 0) > 0) {
        scopeWarning = 'Guest House requests exist at this workflow stage but do not match your department assignment. Check the Guest House department ID mapping.';
      }
    }

    const [rows] = await tx.query(
      `SELECT gb.*, stage_action.decision AS stage_decision
         FROM guesthouse_bookings gb
       ${stageActionJoin}
       ${whereClause}
       ORDER BY gb.created_at ASC
       LIMIT ? OFFSET ?`,
      [normalizedStage, ...whereParams, limit, offset],
    );

    const parsedRows = rows.map((row) => ({
      ...row,
      workflow_state: safeParseJSON(row.workflow_state, null),
      principal_document: safeParseJSON(row.principal_document, null),
    }));

    return {
      items: parsedRows,
      total: Number(countRows?.[0]?.total || 0),
      page,
      limit,
      ...(scopeWarning ? { scopeWarning } : {}),
    };
  },

  async getGuesthouseKpiStats(stage, scopeFilters = {}) {
    const normalizedStage = normalizeText(stage).toLowerCase();
    const workflowStage = `COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(workflow_state, '$.currentStage')), 'null'),
      NULLIF(TRIM(workflow_stage), ''),
      'hod'
    )`;
    const workflowStatus = `COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(workflow_state, '$.status')), 'null'),
      NULLIF(TRIM(workflow_status), ''),
      'in_progress'
    )`;
    const whereParts = [`(${workflowStage} = ? OR stage_action.id IS NOT NULL)`];
    const whereParams = [normalizedStage];

    if (!scopeFilters.forceAll && scopeFilters.scopeType === 'department') {
      const departmentIds = Array.from(scopeFilters.departmentIds || [])
        .map((id) => toPositiveInt(id))
        .filter(Boolean);
      if (scopeFilters.forceEmpty || departmentIds.length === 0) {
        return { total: 0, pending: 0, returned: 0, rejected: 0, approved: 0, archived: 0 };
      }
      whereParts.push('gb.department_id IN (?)');
      whereParams.push(departmentIds);
    }

    const [rows] = await db.query(
      `SELECT CASE
          WHEN stage_action.decision = 'returned' THEN 'returned'
          WHEN stage_action.decision = 'rejected' THEN 'rejected'
          WHEN stage_action.decision = 'approved' THEN 'approved'
          WHEN stage_action.decision = 'archived' THEN 'archived'
          WHEN ${workflowStage} = ? AND ${workflowStatus} IN ('in_progress', 'pending', 'submitted') THEN 'pending'
          ELSE 'other'
        END AS status,
        COUNT(*) AS total
       FROM guesthouse_bookings gb
       LEFT JOIN (
         SELECT wa.record_id, wa.stage, wa.decision, wa.id
           FROM workflow_actions wa
           INNER JOIN (
             SELECT record_id, stage, MAX(id) AS latest_id
               FROM workflow_actions
              WHERE module_key = 'guesthouse'
              GROUP BY record_id, stage
           ) latest ON latest.latest_id = wa.id
       ) stage_action
         ON stage_action.record_id = gb.id
        AND stage_action.stage COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
       WHERE ${whereParts.join(' AND ')}
       GROUP BY status`,
      [normalizedStage, normalizedStage, ...whereParams],
    );
    const stats = { total: 0, pending: 0, returned: 0, rejected: 0, approved: 0, archived: 0 };
    rows.forEach((row) => {
      const count = Number(row.total || 0);
      stats.total += count;
      if (Object.hasOwn(stats, row.status) && row.status !== 'total') {
        stats[row.status] += count;
      }
    });
    return stats;
  },

  // Decisions are written by the shared workflow service to workflow_actions.
  // Keep that audit trail visible on the Guesthouse approval dashboard after a
  // record moves to the next stage (or reaches a terminal state).
  async listGuesthouseStageHistory(stage, actorUserId, filters = {}, { tx = db } = {}) {
    const normalizedStage = normalizeText(stage).toLowerCase();
    const normalizedActorUserId = toPositiveInt(actorUserId);
    if (!normalizedStage || !normalizedActorUserId) return [];

    const whereParts = [
      "wa.module_key = 'guesthouse'",
      'wa.stage = ?',
      'wa.actor_user_id = ?',
    ];
    const params = [normalizedStage, normalizedActorUserId];
    const searchTerm = normalizeText(filters.q || filters.search);
    if (searchTerm) {
      whereParts.push(
        "(LOWER(COALESCE(gb.applicant_name, '')) LIKE LOWER(?) OR LOWER(COALESCE(gb.department, '')) LIKE LOWER(?))",
      );
      const likeTerm = `%${searchTerm}%`;
      params.push(likeTerm, likeTerm);
    }

    const [rows] = await tx.query(
      `SELECT
         gb.*,
         wa.stage AS history_stage,
         wa.decision AS stage_decision,
         wa.feedback AS stage_feedback,
         wa.decided_at AS stage_decided_at,
         0 AS is_actionable
       FROM workflow_actions wa
       INNER JOIN (
         SELECT record_id, stage, MAX(id) AS latest_action_id
         FROM workflow_actions
         WHERE module_key = 'guesthouse'
           AND stage = ?
           AND actor_user_id = ?
         GROUP BY record_id, stage
       ) latest ON latest.latest_action_id = wa.id
       INNER JOIN guesthouse_bookings gb ON gb.id = wa.record_id
       WHERE ${whereParts.join(' AND ')}
       ORDER BY wa.decided_at DESC, wa.id DESC`,
      [normalizedStage, normalizedActorUserId, ...params],
    );

    return rows.map((row) => ({
      ...row,
      workflow_state: safeParseJSON(row.workflow_state, null),
      principal_document: safeParseJSON(row.principal_document, null),
      is_actionable: Boolean(row.is_actionable),
    }));
  },

  // ============================================
  // Room allotment (admin-only, 3rd stage)
  // ============================================

  async upsertRoomAllotment(bookingId, guestId, payload = {}) {
    return withTransaction(async (tx) => {
      await assertRoomAllocationActionable(tx, bookingId);
      const [guestRows] = await tx.query(
        'SELECT id FROM guesthouse_guests WHERE id = ? AND booking_id = ? FOR UPDATE',
        [toPositiveInt(guestId), toPositiveInt(bookingId)],
      );
      if (!guestRows.length) {
        const error = new Error('Room allotment guest does not belong to this booking');
        error.statusCode = 400;
        throw error;
      }
      const [existing] = await tx.query(
        `SELECT id FROM guesthouse_room_allotments WHERE booking_id = ? AND guest_id = ?`,
        [bookingId, guestId],
      );

      let allotmentId;
      if (existing.length) {
        allotmentId = existing[0].id;
        await tx.query(
          `UPDATE guesthouse_room_allotments
              SET caretaker_id = ?, spoc = ?, mobile = ?, amenities = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
          [
            toPositiveInt(payload.caretakerId),
            normalizeText(payload.spoc) || null,
            normalizeText(payload.mobile) || null,
            JSON.stringify(payload.amenities || {}),
            allotmentId,
          ],
        );
      } else {
        const [result] = await tx.query(
          `INSERT INTO guesthouse_room_allotments
             (booking_id, guest_id, caretaker_id, spoc, mobile, amenities)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            bookingId,
            guestId,
            toPositiveInt(payload.caretakerId),
            normalizeText(payload.spoc) || null,
            normalizeText(payload.mobile) || null,
            JSON.stringify(payload.amenities || {}),
          ],
        );
        allotmentId = result.insertId;
      }

      return allotmentId;
    });
  },

  async addRoomAllotmentRow(allotmentId, payload = {}) {
    return withTransaction(async (tx) => {
      const [allotments] = await tx.query('SELECT booking_id FROM guesthouse_room_allotments WHERE id = ?', [toPositiveInt(allotmentId)]);
      if (!allotments.length) {
        const error = new Error('Room allotment not found');
        error.statusCode = 404;
        throw error;
      }
      const booking = await assertRoomAllocationActionable(tx, allotments[0].booking_id);
      const roomId = await assertRoomAvailable(tx, {
        bookingId: allotments[0].booking_id,
        roomId: payload.roomId,
        block: payload.block,
        roomNumber: payload.roomNumber,
        checkInDate: booking.check_in_date,
        checkInTime: booking.check_in_time,
        checkOutDate: booking.check_out_date,
        checkOutTime: booking.check_out_time,
      });
      const [sameBookingRoom] = await tx.query(
        `SELECT 1
           FROM guesthouse_room_allotment_rows grar
           INNER JOIN guesthouse_room_allotments gra ON gra.id = grar.allotment_id
          WHERE gra.booking_id = ?
            AND (grar.room_id = ? OR (grar.room_id IS NULL AND grar.block = ? AND grar.room_number = ?))
          LIMIT 1 FOR UPDATE`,
        [allotments[0].booking_id, roomId, normalizeText(payload.block), normalizeText(payload.roomNumber)],
      );
      if (sameBookingRoom.length) {
        const error = new Error('This room is already assigned to another guest in this booking');
        error.statusCode = 409;
        throw error;
      }
      const [result] = await tx.query(
        `INSERT INTO guesthouse_room_allotment_rows
           (allotment_id, room_id, room_type, block, room_number, remarks, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          allotmentId,
          roomId,
          payload.roomType,
          normalizeText(payload.block) || null,
          normalizeText(payload.roomNumber) || null,
          normalizeText(payload.remarks) || null,
          Number(payload.sortOrder) || 0,
        ],
      );
      const rowId = result.insertId;

      const occupantNames = Array.isArray(payload.occupantNames) ? payload.occupantNames : [];
      for (let index = 0; index < occupantNames.length; index += 1) {
        const occupantName = normalizeText(occupantNames[index]);
        if (!occupantName) continue;
        await tx.query(
          `INSERT INTO guesthouse_room_allotment_row_occupants
             (allotment_row_id, occupant_name, sort_order)
           VALUES (?, ?, ?)`,
          [rowId, occupantName, index],
        );
      }

      return rowId;
    });
  },

  async deleteRoomAllotmentRow(rowId) {
    return withTransaction(async (tx) => {
      const [rows] = await tx.query(
        `SELECT gra.booking_id
           FROM guesthouse_room_allotment_rows grar
           INNER JOIN guesthouse_room_allotments gra ON gra.id = grar.allotment_id
          WHERE grar.id = ?`,
        [toPositiveInt(rowId)],
      );
      if (!rows.length) return false;
      await assertRoomAllocationActionable(tx, rows[0].booking_id);
      const [result] = await tx.query('DELETE FROM guesthouse_room_allotment_rows WHERE id = ?', [toPositiveInt(rowId)]);
      return result.affectedRows > 0;
    });
  },

  async getAllotmentBookingId(allotmentId) {
    const [rows] = await db.query('SELECT booking_id FROM guesthouse_room_allotments WHERE id = ?', [toPositiveInt(allotmentId)]);
    return toPositiveInt(rows[0]?.booking_id);
  },

  async getAllotmentRowBookingId(rowId) {
    const [rows] = await db.query(
      `SELECT gra.booking_id FROM guesthouse_room_allotment_rows grar
       INNER JOIN guesthouse_room_allotments gra ON gra.id = grar.allotment_id
       WHERE grar.id = ?`,
      [toPositiveInt(rowId)],
    );
    return toPositiveInt(rows[0]?.booking_id);
  },

  async saveGuesthouseRoomAllotments(bookingId, allotments = []) {
    const normalizedBookingId = toPositiveInt(bookingId);
    if (!normalizedBookingId) throw new Error('A valid booking is required');

    return withTransaction(async (tx) => {
      const booking = await assertRoomAllocationActionable(tx, normalizedBookingId);
      const roomAssignments = new Set();
      for (const allocation of Array.isArray(allotments) ? allotments : []) {
        for (const room of Array.isArray(allocation?.rows) ? allocation.rows : []) {
          const block = normalizeText(room?.block).toLowerCase();
          const roomNumber = normalizeText(room?.roomNumber).toLowerCase();
          if (!block || !roomNumber) continue;
          const key = `${block}::${roomNumber}`;
          if (roomAssignments.has(key)) {
            const error = new Error(`Room ${normalizeText(room.roomNumber)} in ${normalizeText(room.block)} is assigned more than once in this booking`);
            error.statusCode = 409;
            throw error;
          }
          roomAssignments.add(key);
        }
      }

      const [guestRows] = await tx.query(
        'SELECT id FROM guesthouse_guests WHERE booking_id = ?',
        [normalizedBookingId],
      );
      const bookingGuestIds = new Set(guestRows.map((guest) => Number(guest.id)));

      for (const allocation of Array.isArray(allotments) ? allotments : []) {
        const guestId = toPositiveInt(allocation?.guestId);
        if (!guestId || !bookingGuestIds.has(guestId)) {
          const error = new Error('Room allotment guest does not belong to this booking');
          error.statusCode = 400;
          throw error;
        }

        const [existing] = await tx.query(
          'SELECT id FROM guesthouse_room_allotments WHERE booking_id = ? AND guest_id = ?',
          [normalizedBookingId, guestId],
        );
        let allotmentId = existing[0]?.id;
        const headerValues = [
          toPositiveInt(allocation.caretakerId),
          normalizeText(allocation.spoc) || null,
          normalizeText(allocation.mobile) || null,
          JSON.stringify(allocation.amenities || {}),
        ];

        if (allotmentId) {
          await tx.query(
            `UPDATE guesthouse_room_allotments
                SET caretaker_id = ?, spoc = ?, mobile = ?, amenities = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
            [...headerValues, allotmentId],
          );
          // Rebuild the child rows so a resubmission cannot leave stale rooms/occupants.
          await tx.query('DELETE FROM guesthouse_room_allotment_rows WHERE allotment_id = ?', [allotmentId]);
        } else {
          const [result] = await tx.query(
            `INSERT INTO guesthouse_room_allotments
               (booking_id, guest_id, caretaker_id, spoc, mobile, amenities)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [normalizedBookingId, guestId, ...headerValues],
          );
          allotmentId = result.insertId;
        }

        for (const [index, room] of (Array.isArray(allocation.rows) ? allocation.rows : []).entries()) {
          const roomType = normalizeText(room?.roomType);
          if (!['Single', 'Double', 'Deluxe'].includes(roomType)) continue;
          const roomId = await assertRoomAvailable(tx, {
            bookingId: normalizedBookingId,
            roomId: room?.roomId,
            block: room?.block,
            roomNumber: room?.roomNumber,
            checkInDate: booking.check_in_date,
            checkInTime: booking.check_in_time,
            checkOutDate: booking.check_out_date,
            checkOutTime: booking.check_out_time,
          });
          const [result] = await tx.query(
            `INSERT INTO guesthouse_room_allotment_rows
               (allotment_id, room_id, room_type, block, room_number, remarks, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              allotmentId,
              roomId,
              roomType,
              normalizeText(room.block) || null,
              normalizeText(room.roomNumber) || null,
              normalizeText(room.remarks) || null,
              index,
            ],
          );
          const occupantCount = Math.max(0, Number.parseInt(room.occupants, 10) || 0);
          const occupantNames = Array.isArray(room.occupantNames) ? room.occupantNames : [];
          for (let occupantIndex = 0; occupantIndex < occupantCount; occupantIndex += 1) {
            const occupantName = normalizeText(occupantNames[occupantIndex]) || `Occupant ${occupantIndex + 1}`;
            await tx.query(
              `INSERT INTO guesthouse_room_allotment_row_occupants
                 (allotment_row_id, occupant_name, sort_order)
               VALUES (?, ?, ?)`,
              [result.insertId, occupantName, occupantIndex],
            );
          }
        }
      }
    });
  },

  // ============================================
  // Master data — rooms
  // ============================================

  async listGuesthouseRooms(filters = {}) {
    const whereParts = [];
    const whereParams = [];
    if (filters.status) {
      whereParts.push('status = ?');
      whereParams.push(filters.status);
    }
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const [rows] = await db.query(
      `SELECT gr.*,
              CASE WHEN EXISTS (
                SELECT 1
                FROM guesthouse_room_allotment_rows grar
                INNER JOIN guesthouse_room_allotments gra ON gra.id = grar.allotment_id
                INNER JOIN guesthouse_bookings gb ON gb.id = gra.booking_id
                WHERE (grar.room_id = gr.id OR (grar.room_id IS NULL AND grar.block = gr.block AND grar.room_number = gr.room_number))
                  AND gb.overall_status NOT IN ('rejected', 'archived')
                  AND (? IS NULL OR gb.id <> ?)
                  AND (? IS NULL OR ? IS NULL OR (
                    CAST(CONCAT(gb.check_in_date, ' ', COALESCE(NULLIF(gb.check_in_time, ''), '00:00:00')) AS DATETIME)
                      < CAST(CONCAT(?, ' ', COALESCE(NULLIF(?, ''), '00:00:00')) AS DATETIME)
                    AND CAST(CONCAT(gb.check_out_date, ' ', COALESCE(NULLIF(gb.check_out_time, ''), '00:00:00')) AS DATETIME)
                      > CAST(CONCAT(?, ' ', COALESCE(NULLIF(?, ''), '00:00:00')) AS DATETIME)
                  ))
              ) THEN 1 ELSE 0 END AS is_unavailable
         FROM guesthouse_rooms gr ${whereClause.replace(/\bstatus\b/g, 'gr.status')} ORDER BY gr.block ASC, gr.room_number ASC`,
      [
        toPositiveInt(filters.excludeBookingId), toPositiveInt(filters.excludeBookingId),
        normalizeText(filters.checkInDate) || null, normalizeText(filters.checkOutDate) || null,
        normalizeText(filters.checkOutDate) || null, normalizeText(filters.checkOutTime) || null,
        normalizeText(filters.checkInDate) || null, normalizeText(filters.checkInTime) || null,
        ...whereParams,
      ],
    );
    return rows.map((row) => ({ ...row, facilities: safeParseJSON(row.facilities, null) }));
  },

  async createGuesthouseRoom(payload = {}, createdByUserId) {
    const [result] = await db.query(
      `INSERT INTO guesthouse_rooms (room_type, block, floor, room_number, status, facilities, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.roomType,
        payload.block,
        normalizeText(payload.floor) || null,
        payload.roomNumber,
        normalizeText(payload.status) || 'Active',
        JSON.stringify(payload.facilities || {}),
        toPositiveInt(createdByUserId),
      ],
    );
    return result.insertId;
  },

  async bulkImportResources(type, rows, createdByUserId) {
    if (!['rooms', 'caretakers'].includes(type)) throw new Error('Invalid import type');
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('At least one valid row is required');

    return withTransaction(async (tx) => {
      let imported = 0;
      for (const row of rows) {
        if (type === 'rooms') {
          const roomType = normalizeText(row.roomType);
          const block = normalizeText(row.block);
          const floor = normalizeText(row.floor);
          const roomNumber = normalizeText(row.roomNumber);
          const status = normalizeText(row.status);
          if (!['Single', 'Double', 'Deluxe'].includes(roomType) || !block || !floor || !roomNumber || !['Active', 'Maintenance'].includes(status)) throw new Error('Invalid room data');
          await tx.query(
            `INSERT INTO guesthouse_rooms (room_type, block, floor, room_number, status, facilities, created_by)
             VALUES (?, ?, ?, ?, ?, '{}', ?)
             ON DUPLICATE KEY UPDATE room_type = VALUES(room_type), floor = VALUES(floor), status = VALUES(status), updated_at = CURRENT_TIMESTAMP`,
            [roomType, block, floor, roomNumber, status, toPositiveInt(createdByUserId)],
          );
        } else {
          const name = normalizeText(row.name);
          const mobile = normalizeText(row.mobile);
          const status = normalizeText(row.status);
          if (!name || !mobile || !['Active', 'Leave'].includes(status)) throw new Error('Invalid care taker data');
          await tx.query(
            `INSERT INTO guesthouse_caretakers (name, mobile, status, created_by)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE status = VALUES(status), updated_at = CURRENT_TIMESTAMP`,
            [name, mobile, status, toPositiveInt(createdByUserId)],
          );
        }
        imported += 1;
      }
      return { imported };
    });
  },

  async updateGuesthouseRoom(roomId, payload = {}) {
    const normalizedRoomId = toPositiveInt(roomId);
    const [existing] = await db.query('SELECT id FROM guesthouse_rooms WHERE id = ?', [normalizedRoomId]);
    if (!existing.length) return false;
    const [result] = await db.query(
      `UPDATE guesthouse_rooms
          SET room_type = ?, block = ?, floor = ?, room_number = ?, status = ?, facilities = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        payload.roomType,
        payload.block,
        normalizeText(payload.floor) || null,
        payload.roomNumber,
        normalizeText(payload.status) || 'Active',
        JSON.stringify(payload.facilities || {}),
        normalizedRoomId,
      ],
    );
    return result.affectedRows >= 0;
  },

  async deleteGuesthouseRoom(roomId) {
    const [result] = await db.query(`DELETE FROM guesthouse_rooms WHERE id = ?`, [
      toPositiveInt(roomId),
    ]);
    return result.affectedRows > 0;
  },

  // ============================================
  // Master data — care takers
  // ============================================

  async listGuesthouseCaretakers(filters = {}) {
    const whereParts = [];
    const whereParams = [];
    if (filters.status) {
      whereParts.push('status = ?');
      whereParams.push(filters.status);
    }
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const [rows] = await db.query(
      `SELECT * FROM guesthouse_caretakers ${whereClause} ORDER BY name ASC`,
      whereParams,
    );
    return rows;
  },

  async createGuesthouseCaretaker(payload = {}, createdByUserId) {
    const [result] = await db.query(
      `INSERT INTO guesthouse_caretakers (name, mobile, status, created_by)
       VALUES (?, ?, ?, ?)`,
      [
        payload.name,
        normalizeText(payload.mobile) || null,
        normalizeText(payload.status) || 'Active',
        toPositiveInt(createdByUserId),
      ],
    );
    return result.insertId;
  },

  async updateGuesthouseCaretaker(caretakerId, payload = {}) {
    const normalizedCaretakerId = toPositiveInt(caretakerId);
    const [existing] = await db.query('SELECT id FROM guesthouse_caretakers WHERE id = ?', [normalizedCaretakerId]);
    if (!existing.length) return false;
    const [result] = await db.query(
      `UPDATE guesthouse_caretakers
          SET name = ?, mobile = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        payload.name,
        normalizeText(payload.mobile) || null,
        normalizeText(payload.status) || 'Active',
        normalizedCaretakerId,
      ],
    );
    return result.affectedRows >= 0;
  },

  async deleteGuesthouseCaretaker(caretakerId) {
    const [result] = await db.query(`DELETE FROM guesthouse_caretakers WHERE id = ?`, [
      toPositiveInt(caretakerId),
    ]);
    return result.affectedRows > 0;
  },

  async updateGuesthousePrincipalDocument(bookingId, document) {
    const normalizedId = toPositiveInt(bookingId);
    if (!normalizedId) return false;
    const [result] = await db.query(
      `UPDATE guesthouse_bookings
          SET principal_document = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [document ? JSON.stringify(document) : null, normalizedId],
    );
    return result.affectedRows > 0 || result.changedRows === 0;
  },

  async updateGuesthouseTravelSchedule(bookingId, schedule = {}, workflowGuard = {}) {
    const normalizedId = toPositiveInt(bookingId);
    const checkInDate = normalizeText(schedule.checkInDate || schedule.check_in_date);
    const checkOutDate = normalizeText(schedule.checkOutDate || schedule.check_out_date);
    const checkInTime = normalizeText(schedule.checkInTime || schedule.check_in_time);
    const checkOutTime = normalizeText(schedule.checkOutTime || schedule.check_out_time);
    if (!normalizedId) return false;

    return withTransaction(async (tx) => {
      const booking = await getGuesthouseBookingForUpdate(tx, normalizedId);
      if (!booking) return false;
      assertWorkflowState(booking, {
        ...workflowGuard,
        conflictMessage: 'Travel schedule can only be changed while the booking remains active in the current workflow stage',
      });

      const [allocatedRooms] = await tx.query(
        `SELECT grar.room_id, grar.block, grar.room_number
           FROM guesthouse_room_allotment_rows grar
           INNER JOIN guesthouse_room_allotments gra ON gra.id = grar.allotment_id
          WHERE gra.booking_id = ?
          ORDER BY grar.room_id, grar.block, grar.room_number
          FOR UPDATE`,
        [normalizedId],
      );
      for (const room of allocatedRooms) {
        await assertRoomAvailable(tx, {
          bookingId: normalizedId,
          roomId: room.room_id,
          block: room.block,
          roomNumber: room.room_number,
          checkInDate,
          checkInTime,
          checkOutDate,
          checkOutTime,
          requireActive: false,
        });
      }

      const [result] = await tx.query(
        `UPDATE guesthouse_bookings
            SET check_in_date = ?, check_in_time = ?, check_out_date = ?, check_out_time = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [checkInDate, checkInTime, checkOutDate, checkOutTime, normalizedId],
      );
      return result.affectedRows > 0 || result.changedRows === 0;
    }, { tx: workflowGuard.tx || null });
  },

};

export default guesthouseModel;
