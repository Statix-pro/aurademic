import db from '../../config/connection.js';

/**
 * The Tag and Specialization lists the Directory Admin keeps for a directory, and the
 * Specializations a record picks from them. Organizations and resource persons each have
 * their own tables (the two directories stay independent); this holds the rules they share:
 *
 *   - A record's Tag and Specializations must come from the active list, and are stored
 *     in the list's spelling. A value since retired is still accepted on a record that
 *     already holds it, so editing never forces its owner to drop it.
 *   - Values are stored by name, so renaming or retiring an entry changes only what the
 *     form offers next.
 *   - Deleting an entry a record still uses retires it instead.
 *
 * Table and column names come only from the code-controlled config below.
 */
export const DEFAULT_TAG = 'General';
const LIST_KEYS = ['tag', 'specialization'];

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

const toOptionName = (name) => {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw failWith('Name is required.', 400);
  if (trimmed.length > 255) throw failWith('Name must be 255 characters or fewer.', 400);
  return trimmed;
};

/**
 * @param {object} tables
 * @param {string} tables.options      list table (list_key, name, is_active)
 * @param {string} tables.picks        a record's specializations (<recordColumn>, name, sort_order)
 * @param {string} tables.recordColumn the picks table's column naming the record
 * @param {string} tables.records      the record table, whose `tag` column holds the Tag
 */
export const createDirectoryLists = ({ options, picks, recordColumn, records }) => ({
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
      `SELECT list_key, name FROM ${options} WHERE is_active = 1`,
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

  // Active entries feed the form; the Directory Admin's page asks for retired ones too.
  async listOptions({ includeInactive = false } = {}) {
    const [rows] = await db.query(
      `SELECT id, list_key, name, is_active FROM ${options}
       ${includeInactive ? '' : 'WHERE is_active = 1'}
       ORDER BY list_key, name`,
    );
    return rows.map((row) => ({ ...row, is_active: Boolean(row.is_active) }));
  },

  /**
   * Adds one entry (`name`) or several at once (`names`, e.g. split from "A, B, C").
   * Names already in the list -- compared case-insensitively, as the unique key does --
   * are skipped rather than failing the rest; the caller reports them.
   */
  async addOptions(listKey, input = {}) {
    if (!LIST_KEYS.includes(listKey)) throw failWith('Unknown list.', 400);
    const requested = Array.isArray(input.names) ? input.names : [input.name];
    if (!requested.length) throw failWith('Name is required.', 400);
    if (requested.length > 200) throw failWith('Add at most 200 entries at a time.', 400);
    const names = [];
    for (const raw of requested) {
      const name = toOptionName(raw);
      if (!names.some((n) => n.toLowerCase() === name.toLowerCase())) names.push(name);
    }
    const [existing] = await db.execute(`SELECT name FROM ${options} WHERE list_key = ?`, [
      listKey,
    ]);
    const taken = new Set(existing.map((row) => row.name.toLowerCase()));
    const fresh = names.filter((name) => !taken.has(name.toLowerCase()));
    const skipped = names.filter((name) => taken.has(name.toLowerCase()));
    if (!fresh.length) {
      throw failWith(
        `${skipped.length === 1 ? `"${skipped[0]}" is` : 'These are all'} already in the list.`,
        409,
      );
    }
    const isActive = input.is_active === false ? 0 : 1;
    try {
      await db.execute(
        `INSERT INTO ${options} (list_key, name, is_active) VALUES ${fresh.map(() => '(?,?,?)').join(', ')}`,
        fresh.flatMap((name) => [listKey, name, isActive]),
      );
    } catch (error) {
      // Another admin added one of these between the check and the insert.
      if (error?.code === 'ER_DUP_ENTRY')
        throw failWith('Some of these were just added by someone else. Reload and try again.', 409);
      throw error;
    }
    const [rows] = await db.execute(
      `SELECT id, list_key, name, is_active FROM ${options}
       WHERE list_key = ? AND name IN (${fresh.map(() => '?').join(', ')})`,
      [listKey, ...fresh],
    );
    return {
      added: rows.map((row) => ({ ...row, is_active: Boolean(row.is_active) })),
      skipped,
    };
  },

  async updateOption(id, input = {}) {
    const name = toOptionName(input.name);
    try {
      const [result] = await db.execute(
        `UPDATE ${options} SET name = ?, is_active = ? WHERE id = ?`,
        [name, input.is_active === false ? 0 : 1, id],
      );
      if (!result.affectedRows) throw failWith('List entry not found.', 404);
      const [[row]] = await db.execute(
        `SELECT id, list_key, name, is_active FROM ${options} WHERE id = ?`,
        [id],
      );
      return { ...row, is_active: Boolean(row.is_active) };
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') throw failWith(`"${name}" is already in the list.`, 409);
      throw error;
    }
  },

  async deleteOption(id) {
    const [[entry]] = await db.execute(`SELECT list_key, name FROM ${options} WHERE id = ?`, [id]);
    if (!entry) throw failWith('List entry not found.', 404);
    const [[usage]] = await db.execute(
      entry.list_key === 'tag'
        ? `SELECT COUNT(*) AS used FROM ${records} WHERE tag = ?`
        : `SELECT COUNT(*) AS used FROM ${picks} WHERE name = ?`,
      [entry.name],
    );
    if (Number(usage.used) > 0) {
      await db.execute(`UPDATE ${options} SET is_active = 0 WHERE id = ?`, [id]);
      return { id: Number(id), deleted: false, deactivated: true };
    }
    await db.execute(`DELETE FROM ${options} WHERE id = ?`, [id]);
    return { id: Number(id), deleted: true, deactivated: false };
  },
});
