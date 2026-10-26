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

  async toListedValues(connection, { tag, specializations }, current = {}) {
    const [rows] = await connection.execute(
      `SELECT list_key, name FROM ${OPTIONS} WHERE is_active = 1`,
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
});

// Active entries feed the forms; the Directory Admin's page asks for retired ones too.
export const listOptions = async ({ includeInactive = false } = {}) => {
  const [rows] = await db.query(
    `SELECT id, list_key, name, is_active FROM ${OPTIONS}
       ${includeInactive ? '' : 'WHERE is_active = 1'}
       ORDER BY list_key, name`,
  );
  return rows.map((row) => ({ ...row, is_active: Boolean(row.is_active) }));
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
      `SELECT id, list_key, name, is_active FROM ${OPTIONS}
         WHERE id IN (${addedIds.map(() => '?').join(', ')})`,
      addedIds,
    );
    await connection.commit();
    return {
      added: rows.map((row) => ({ ...row, is_active: Boolean(row.is_active) })),
      skipped,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const updateOption = async (id, input = {}) => {
  const [[entry]] = await db.execute(`SELECT list_key, name FROM ${OPTIONS} WHERE id = ?`, [id]);
  if (!entry) throw failWith('List entry not found.', 404);
  const name = toOptionName(input.name, entry.list_key);
  if (isDefaultTag(entry) && (name !== entry.name || input.is_active === false))
    throw failWith(DEFAULT_TAG_LOCKED, 400);
  try {
    const [result] = await db.execute(
      `UPDATE ${OPTIONS} SET name = ?, is_active = ? WHERE id = ?`,
      [name, input.is_active === false ? 0 : 1, id],
    );
    if (!result.affectedRows) throw failWith('List entry not found.', 404);
    const [[row]] = await db.execute(
      `SELECT id, list_key, name, is_active FROM ${OPTIONS} WHERE id = ?`,
      [id],
    );
    return { ...row, is_active: Boolean(row.is_active) };
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
