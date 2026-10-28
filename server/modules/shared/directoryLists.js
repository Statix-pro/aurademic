import db from '../../config/connection.js';

/**
 * The one Tag list and one Specialization list both directories pick from, kept by either
 * directory's Directory Admin (or a super admin), and the Specializations a record picks
 * from them. Each directory still stores its own records and picks; this holds the rules
 * they share:
 *
 *   - A record's Tag and Specializations must come from the active list, and are stored
 *     in the list's spelling. A value since retired is still accepted on a record that
 *     already holds it, so editing never forces its owner to drop it.
 *   - Values are stored by name, so renaming or retiring an entry changes only what the
 *     forms offer next.
 *   - Deleting an entry a record in either directory still uses retires it instead.
 *   - A directory user may suggest a Specialization from the form. It waits, Pending, for
 *     the Directory Admin; meanwhile only its suggester is offered it, and a record that
 *     holds it -- Pending, or Rejected -- cannot be approved (see loadSpecializationHolds).
 *
 * Table and column names come only from the code-controlled config below.
 */
export const DEFAULT_TAG = 'General';
const LIST_KEYS = ['tag', 'specialization'];
const OPTIONS = 'directory_options';
// Where each directory keeps its records' Tag and their Specialization picks; an entry is in
// use while any of them holds it.
const USAGE = [
  { records: 'organizations', picks: 'directory_organization_specializations' },
  { records: 'directory_resource_persons', picks: 'directory_resource_person_specializations' },
];

const failWith = (message, status) => Object.assign(new Error(message), { status });

export const parseSpecializations = (value) => {
  let specializations = value ?? [];
  if (typeof specializations === 'string') {
    try {
      specializations = specializations ? JSON.parse(specializations) : [];
    } catch {
      throw failWith('Specializations must be a JSON array', 400);
    }
  }
  if (!Array.isArray(specializations) || specializations.some((v) => typeof v !== 'string')) {
    throw failWith('Specializations must be a JSON array', 400);
  }
  return specializations.map((v) => v.trim()).filter(Boolean);
};

// A Tag is stored in the record's `tag` column, VARCHAR(100); a Specialization in a picks
// table's VARCHAR(255) `name`. An entry longer than its column could be picked but not saved.
const MAX_NAME_LENGTH = { tag: 100, specialization: 255 };

const toOptionName = (name, listKey) => {
  const trimmed = String(name ?? '').trim();
  const max = MAX_NAME_LENGTH[listKey];
  if (!trimmed) throw failWith('Name is required.', 400);
  if (trimmed.length > max) throw failWith(`Name must be ${max} characters or fewer.`, 400);
  return trimmed;
};

// General is the Tag a record gets when none is chosen (the forms send it, and it is the
// columns' default), so its entry stays in the Tag list, active and under that name. The
// directory migration also relies on the Tag list never being empty again once seeded.
const isDefaultTag = (entry) =>
  entry.list_key === 'tag' && entry.name.toLowerCase() === DEFAULT_TAG.toLowerCase();
const DEFAULT_TAG_LOCKED = `"${DEFAULT_TAG}" is the Tag a record gets when none is chosen, so it stays in the list as it is.`;

/**
 * @param {object} tables
 * @param {string} tables.picks        a record's specializations (<recordColumn>, name, sort_order)
 * @param {string} tables.recordColumn the picks table's column naming the record
 */
export const createDirectoryLists = ({ picks, recordColumn }) => ({
  async loadSpecializationsByRecord(recordIds) {
    if (!recordIds.length) return new Map();
    const placeholders = recordIds.map(() => '?').join(', ');
    const [rows] = await db.query(
      `SELECT ${recordColumn}, name FROM ${picks}
       WHERE ${recordColumn} IN (${placeholders})
       ORDER BY ${recordColumn}, sort_order, id`,
      recordIds,
    );
    const byRecord = new Map();
    for (const row of rows) {
      const recordId = Number(row[recordColumn]);
      byRecord.set(recordId, [...(byRecord.get(recordId) || []), row.name]);
    }
    return byRecord;
  },

  async loadSpecializations(connection, recordId) {
    const [rows] = await connection.execute(
      `SELECT name FROM ${picks} WHERE ${recordColumn} = ? ORDER BY sort_order, id`,
      [recordId],
    );
    return rows.map((row) => row.name);
  },

  /**
   * `userId` is the saver: their own Pending suggestions may be picked as well. Another
   * user's Pending entry, or a Rejected one, may not -- unless the record already holds it.
   */
  async toListedValues(connection, { tag, specializations }, current = {}, { userId } = {}) {
    const [rows] = await connection.execute(
      `SELECT list_key, name FROM ${OPTIONS}
        WHERE is_active = 1
          AND (approval_status = 'Approved'
               OR (approval_status = 'Pending' AND list_key = 'specialization'
                   AND suggested_by = ?))`,
      [userId ?? null],
    );
    const allowed = { tag: new Map(), specialization: new Map() };
    for (const row of rows) allowed[row.list_key]?.set(row.name.toLowerCase(), row.name);
    for (const kept of current.tag ? [current.tag] : [])
      if (!allowed.tag.has(kept.toLowerCase())) allowed.tag.set(kept.toLowerCase(), kept);
    for (const kept of current.specializations || [])
      if (!allowed.specialization.has(kept.toLowerCase()))
        allowed.specialization.set(kept.toLowerCase(), kept);

    const listedTag =
      tag === DEFAULT_TAG ? DEFAULT_TAG : allowed.tag.get(String(tag).trim().toLowerCase());
    if (!listedTag) throw failWith(`"${tag}" is not in the Tag list.`, 400);
    const listedSpecializations = [];
    for (const value of specializations) {
      const listed = allowed.specialization.get(value.toLowerCase());
      if (!listed) throw failWith(`"${value}" is not in the Specialization list.`, 400);
      if (!listedSpecializations.includes(listed)) listedSpecializations.push(listed);
    }
    return { tag: listedTag, specializations: listedSpecializations };
  },

  async replaceSpecializations(connection, recordId, specializations, { isNew = false } = {}) {
    if (!isNew)
      await connection.execute(`DELETE FROM ${picks} WHERE ${recordColumn} = ?`, [recordId]);
    for (const [index, name] of specializations.entries())
      await connection.execute(
        `INSERT INTO ${picks} (${recordColumn}, name, sort_order) VALUES (?,?,?)`,
        [recordId, name, index],
      );
  },

  /**
   * The suggested Specializations that keep each record from being approved: those still
   * Pending, and those the admin Rejected (the owner has to edit them out). `{ name, status }`
   * per entry, keyed by record id. `lock` (inside a transaction, `tx`) share-locks the entries
   * read, so one cannot leave Approved before that transaction ends.
   */
  async loadSpecializationHolds(recordIds, { tx = db, lock = false } = {}) {
    if (!recordIds.length) return new Map();
    const [rows] = await tx.query(
      `SELECT p.${recordColumn} AS record_id, o.name, o.approval_status
         FROM ${picks} p
         JOIN ${OPTIONS} o ON o.list_key = 'specialization' AND o.name = p.name
        WHERE p.${recordColumn} IN (${recordIds.map(() => '?').join(', ')})
          AND o.approval_status <> 'Approved'
        ORDER BY p.${recordColumn}, p.sort_order${lock ? ' FOR SHARE' : ''}`,
      recordIds,
    );
    const byRecord = new Map();
    for (const row of rows) {
      const recordId = Number(row.record_id);
      const holds = byRecord.get(recordId) || [];
      if (!holds.some((hold) => hold.name === row.name))
        byRecord.set(recordId, [...holds, { name: row.name, status: row.approval_status }]);
    }
    return byRecord;
  },
});

/**
 * The approval error for a record held by suggested Specializations, or null. One message
 * for both directories, so a reviewer reads the same reason on either approval page.
 */
export const specializationHoldError = (holds = []) => {
  if (!holds.length) return null;
  const quoted = (status) =>
    holds.filter((hold) => hold.status === status).map((hold) => `"${hold.name}"`);
  const pending = quoted('Pending');
  const rejected = quoted('Rejected');
  return failWith(
    [
      pending.length &&
        `Approve the specialization ${pending.join(', ')} on the Directory Lists page first; it is still pending.`,
      rejected.length &&
        `The specialization ${rejected.join(', ')} was rejected; the submitter needs to remove it.`,
    ]
      .filter(Boolean)
      .join(' '),
    409,
  );
};

const serializeOption = (row) => ({
  id: row.id,
  list_key: row.list_key,
  name: row.name,
  is_active: Boolean(row.is_active),
  approval_status: row.approval_status ?? 'Approved',
  ...(row.suggested_by_name !== undefined
    ? { suggested_by_name: row.suggested_by_name, suggested_by_email: row.suggested_by_email }
    : {}),
});

/**
 * The forms get the active, approved entries plus `userId`'s own Pending suggestions. The
 * Directory Admin's page (`includeInactive`) gets every entry, retired and suggested ones
 * included, with who suggested it.
 */
export const listOptions = async ({ includeInactive = false, userId = null } = {}) => {
  const [rows] = includeInactive
    ? await db.query(
        `SELECT o.id, o.list_key, o.name, o.is_active, o.approval_status,
                u.name AS suggested_by_name, u.email AS suggested_by_email
           FROM ${OPTIONS} o
           LEFT JOIN users u ON u.id = o.suggested_by
          ORDER BY o.list_key, o.name`,
      )
    : await db.query(
        `SELECT id, list_key, name, is_active, approval_status FROM ${OPTIONS}
          WHERE is_active = 1
            AND (approval_status = 'Approved'
                 OR (approval_status = 'Pending' AND suggested_by = ?))
          ORDER BY list_key, name`,
        [userId ?? null],
      );
  return rows.map(serializeOption);
};

const loadOption = async (connection, id) => {
  const [[row]] = await connection.execute(
    `SELECT id, list_key, name, is_active, approval_status FROM ${OPTIONS} WHERE id = ?`,
    [id],
  );
  return row ? serializeOption(row) : null;
};

/**
 * A directory user adds a Specialization from the form. A name the list already holds is
 * not added twice -- the database compares it under the column's collation (case and
 * accents ignored), as addOptions does:
 *   - Approved and active, or the user's own Pending suggestion: returned, to be selected.
 *   - Retired, another user's Pending suggestion, or Rejected: refused with the reason.
 * Anything else is added Pending, with the user as its suggester.
 */
export const suggestSpecialization = async (input = {}, userId) => {
  const name = toOptionName(input.name, 'specialization');
  if (!userId) throw failWith('Sign in again to suggest a specialization.', 401);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[listed]] = await connection.execute(
      `SELECT id, name, is_active, approval_status, suggested_by FROM ${OPTIONS}
        WHERE list_key = 'specialization' AND name = ? FOR UPDATE`,
      [name],
    );
    if (listed) {
      const own = Number(listed.suggested_by) === Number(userId);
      if (listed.approval_status === 'Rejected')
        throw failWith(`"${listed.name}" was suggested before and not approved.`, 409);
      if (listed.approval_status === 'Pending' && !own)
        throw failWith(
          `"${listed.name}" has already been suggested and is waiting for the Directory Admin.`,
          409,
        );
      if (!Number(listed.is_active))
        throw failWith(`"${listed.name}" was retired from the list by the Directory Admin.`, 409);
      const existing = await loadOption(connection, listed.id);
      await connection.commit();
      return { entry: existing, created: false };
    }
    let insertId;
    try {
      [{ insertId }] = await connection.execute(
        `INSERT INTO ${OPTIONS} (list_key, name, is_active, approval_status, suggested_by)
         VALUES ('specialization', ?, 1, 'Pending', ?)`,
        [name, userId],
      );
    } catch (error) {
      // Someone added the same name since the check; they can pick it once it is listed.
      if (error?.code === 'ER_DUP_ENTRY')
        throw failWith(`"${name}" was just added by someone else. Search for it again.`, 409);
      throw error;
    }
    const entry = await loadOption(connection, insertId);
    await connection.commit();
    return { entry, created: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/** The Directory Admin approves or rejects a suggested entry; only a Pending one. */
export const reviewOption = async (id, decision, reviewerId) => {
  if (!['approve', 'reject'].includes(decision))
    throw failWith('Decision must be approve or reject.', 400);
  const status = decision === 'approve' ? 'Approved' : 'Rejected';
  const [result] = await db.execute(
    `UPDATE ${OPTIONS}
        SET approval_status = ?, reviewed_by = ?, reviewed_at = NOW()
      WHERE id = ? AND approval_status = 'Pending'`,
    [status, reviewerId ?? null, id],
  );
  if (!result.affectedRows) {
    const existing = await loadOption(db, id);
    if (!existing) throw failWith('List entry not found.', 404);
    throw failWith(`This suggestion was already ${existing.approval_status.toLowerCase()}.`, 409);
  }
  return loadOption(db, id);
};

/**
 * Adds one entry (`name`) or several at once (`names`, e.g. split from "A, B, C").
 * Names already in the list are skipped rather than failing the rest; the caller reports
 * them. "Already in the list" is decided by the database, under the column's collation
 * (utf8mb4_unicode_ci ignores accents as well as case, so "Cafe" matches "Café"): a check
 * in JavaScript would miss those, and the unique key would then fail the whole add.
 */
export const addOptions = async (listKey, input = {}) => {
  if (!LIST_KEYS.includes(listKey)) throw failWith('Unknown list.', 400);
  const requested = Array.isArray(input.names) ? input.names : [input.name];
  if (!requested.length) throw failWith('Name is required.', 400);
  if (requested.length > 200) throw failWith('Add at most 200 entries at a time.', 400);
  const names = [];
  for (const raw of requested) {
    const name = toOptionName(raw, listKey);
    if (!names.some((n) => n.toLowerCase() === name.toLowerCase())) names.push(name);
  }
  const isActive = input.is_active === false ? 0 : 1;
  const addedIds = [];
  const skipped = [];
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const name of names) {
      const [[listed]] = await connection.execute(
        `SELECT id FROM ${OPTIONS} WHERE list_key = ? AND name = ?`,
        [listKey, name],
      );
      if (listed) {
        skipped.push(name);
        continue;
      }
      try {
        const [result] = await connection.execute(
          `INSERT INTO ${OPTIONS} (list_key, name, is_active) VALUES (?,?,?)`,
          [listKey, name, isActive],
        );
        addedIds.push(result.insertId);
      } catch (error) {
        // Another admin added it since the check; only this statement is undone.
        if (error?.code !== 'ER_DUP_ENTRY') throw error;
        skipped.push(name);
      }
    }
    if (!addedIds.length) {
      throw failWith(
        `${skipped.length === 1 ? `"${skipped[0]}" is` : 'These are all'} already in the list.`,
        409,
      );
    }
    const [rows] = await connection.execute(
      `SELECT id, list_key, name, is_active, approval_status FROM ${OPTIONS}
         WHERE id IN (${addedIds.map(() => '?').join(', ')})`,
      addedIds,
    );
    await connection.commit();
    return { added: rows.map(serializeOption), skipped };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateOption = async (id, input = {}) => {
  const [[entry]] = await db.execute(
    `SELECT list_key, name, approval_status FROM ${OPTIONS} WHERE id = ?`,
    [id],
  );
  if (!entry) throw failWith('List entry not found.', 404);
  // Records that picked a suggestion hold it by name, so renaming it would leave them
  // holding a name the list no longer has -- and no longer held for review.
  if (entry.approval_status && entry.approval_status !== 'Approved')
    throw failWith('Approve or reject this suggestion; it cannot be edited until then.', 409);
  const name = toOptionName(input.name, entry.list_key);
  if (isDefaultTag(entry) && (name !== entry.name || input.is_active === false))
    throw failWith(DEFAULT_TAG_LOCKED, 400);
  try {
    const [result] = await db.execute(
      `UPDATE ${OPTIONS} SET name = ?, is_active = ? WHERE id = ?`,
      [name, input.is_active === false ? 0 : 1, id],
    );
    if (!result.affectedRows) throw failWith('List entry not found.', 404);
    return loadOption(db, id);
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') throw failWith(`"${name}" is already in the list.`, 409);
    throw error;
  }
};

export const deleteOption = async (id) => {
  const [[entry]] = await db.execute(`SELECT list_key, name FROM ${OPTIONS} WHERE id = ?`, [id]);
  if (!entry) throw failWith('List entry not found.', 404);
  if (isDefaultTag(entry)) throw failWith(DEFAULT_TAG_LOCKED, 400);
  const counts = USAGE.map(({ records, picks }) =>
    entry.list_key === 'tag'
      ? `(SELECT COUNT(*) FROM ${records} WHERE tag = ?)`
      : `(SELECT COUNT(*) FROM ${picks} WHERE name = ?)`,
  );
  const [[usage]] = await db.execute(
    `SELECT ${counts.join(' + ')} AS used`,
    USAGE.map(() => entry.name),
  );
  if (Number(usage.used) > 0) {
    await db.execute(`UPDATE ${OPTIONS} SET is_active = 0 WHERE id = ?`, [id]);
    return { id: Number(id), deleted: false, deactivated: true };
  }
  await db.execute(`DELETE FROM ${OPTIONS} WHERE id = ?`, [id]);
  return { id: Number(id), deleted: true, deactivated: false };
};
