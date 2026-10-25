/**
 * Crediting imported Scopus papers to staff by Scopus Author ID.
 *
 * A staff member's IDs are the main one on their staff record (`master_employees.scopus_id`)
 * plus any further ones in `employee_scopus_ids` — Scopus often splits one person's papers over
 * several profiles. Only an author position that gave a KSRCT affiliation is credited: a staff
 * member's paper from another institution is not a KSRCT publication.
 */

/** How `v_authors` names KSRCT for a staff author; unmatched KSRCT authors are listed the same way. */
export const KSRCT_ORGANIZATION = 'K.S.Rangasamy College of Technology';

export const SCOPUS_AUTHOR_ID = /^\d{5,15}$/;

const employeeName = `TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')))`;

const parseJsonArray = (raw) => {
  if (!raw) return [];
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(value) ? value : [];
  } catch {
    // An unreadable value is left alone rather than overwritten with a guess.
    return null;
  }
};

/**
 * Every Scopus Author ID on file, with its staff member. An ID on file for two different staff
 * members credits neither: which of them wrote the papers is for a person to settle, and the
 * ID is returned under `conflicts` so the screens can say so.
 */
export const loadStaffScopusIds = async (executor) => {
  // Two reads rather than a UNION: master_employees' text columns carry their own collation,
  // which MySQL refuses to combine with a cast number's.
  const [[main], [extra]] = await Promise.all([
    executor.query(
      `SELECT e.id, TRIM(e.scopus_id) AS scopus_id, ${employeeName} AS name, e.erp_id
         FROM master_employees e
        WHERE e.scopus_id IS NOT NULL AND TRIM(e.scopus_id) <> ''`,
    ),
    executor.query(
      `SELECT e.id, x.scopus_author_id, ${employeeName} AS name, e.erp_id
         FROM employee_scopus_ids x
         JOIN master_employees e ON e.id = x.employee_id`,
    ),
  ]);
  const rows = [
    ...main,
    ...extra.map(({ scopus_author_id: scopusAuthorId, ...row }) => ({
      ...row,
      scopus_id: String(scopusAuthorId),
    })),
  ];

  const byScopusId = new Map();
  const conflicts = new Set();
  for (const row of rows) {
    if (!SCOPUS_AUTHOR_ID.test(row.scopus_id)) continue;
    const held = byScopusId.get(row.scopus_id);
    if (held && held.id !== row.id) conflicts.add(row.scopus_id);
    else byScopusId.set(row.scopus_id, row);
  }
  for (const id of conflicts) byScopusId.delete(id);
  return { byScopusId, conflicts, rows: [...byScopusId.values()] };
};

/** The staff member's `authors` row, created the way the publication form creates one. */
export const ensureStaffAuthor = async (connection, employeeId, cache) => {
  if (cache?.has(employeeId)) return cache.get(employeeId);
  const [existing] = await connection.query(
    'SELECT id FROM authors WHERE employee_id = ? ORDER BY id LIMIT 1',
    [employeeId],
  );
  let authorId = existing[0]?.id;
  if (!authorId) {
    // Name and email come from master_employees through v_authors.
    const [inserted] = await connection.query(
      `INSERT INTO authors (employee_id, name, email, designation) VALUES (?, NULL, NULL, 'faculty')`,
      [employeeId],
    );
    authorId = inserted.insertId;
  }
  cache?.set(employeeId, authorId);
  return authorId;
};

export const linkStaffAuthor = (connection, authorId, journalId, position) =>
  connection.query(
    `INSERT INTO author_journal (author_id, journal_id, is_first_author, is_primary)
     VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE is_first_author = GREATEST(is_first_author, VALUES(is_first_author))`,
    [authorId, journalId, position === 1 ? 1 : 0],
  );

/**
 * Credits a staff member with every imported paper on which one of `scopusIds` is a KSRCT
 * author nobody has been credited for yet. The author moves from the paper's external list to
 * its staff authors. Returns how many papers were credited.
 */
export const creditScopusIds = async (connection, employeeId, scopusIds) => {
  if (scopusIds.length === 0) return 0;
  const [positions] = await connection.query(
    `SELECT id, journal_id, author_position, CAST(scopus_author_id AS CHAR) AS scopus_author_id
       FROM journal_scopus_authors
      WHERE scopus_author_id IN (?) AND is_ksrct = 1 AND employee_id IS NULL
      ORDER BY journal_id, author_position
      FOR UPDATE`,
    [scopusIds],
  );
  if (positions.length === 0) return 0;

  const authorId = await ensureStaffAuthor(connection, employeeId);
  const journalIds = [...new Set(positions.map((position) => position.journal_id))];
  for (const position of positions) {
    await linkStaffAuthor(connection, authorId, position.journal_id, position.author_position);
  }
  await connection.query('UPDATE journal_scopus_authors SET employee_id = ? WHERE id IN (?)', [
    employeeId,
    positions.map((position) => position.id),
  ]);

  const ids = new Set(scopusIds.map(String));
  const [journals] = await connection.query(
    'SELECT id, external_details FROM journals WHERE id IN (?) FOR UPDATE',
    [journalIds],
  );
  for (const journal of journals) {
    const external = parseJsonArray(journal.external_details);
    if (!external) continue;
    const kept = external.filter((author) => !ids.has(String(author?.scopus_author_id ?? '')));
    if (kept.length === external.length) continue;
    await connection.query('UPDATE journals SET external_details = ? WHERE id = ?', [
      kept.length > 0 ? JSON.stringify(kept) : null,
      journal.id,
    ]);
  }
  return journalIds.length;
};

/**
 * Undoes `creditScopusIds` for one ID: the positions go back to unassigned and the author back
 * to the external list. The staff member is taken off a paper only when the import created it
 * and no other of their IDs credits them on it; a paper someone filed on the form keeps the
 * author list they gave it.
 */
export const uncreditScopusId = async (connection, employeeId, scopusId) => {
  const [positions] = await connection.query(
    `SELECT s.id, s.journal_id, s.author_position, s.author_name,
            (j.created_by IS NULL AND j.import_batch_id IS NOT NULL) AS imported
       FROM journal_scopus_authors s
       JOIN journals j ON j.id = s.journal_id
      WHERE s.scopus_author_id = ? AND s.employee_id = ?
      FOR UPDATE`,
    [scopusId, employeeId],
  );
  if (positions.length === 0) return 0;

  await connection.query('UPDATE journal_scopus_authors SET employee_id = NULL WHERE id IN (?)', [
    positions.map((position) => position.id),
  ]);

  const journalIds = [...new Set(positions.map((position) => position.journal_id))];
  const [stillCredited] = await connection.query(
    `SELECT DISTINCT journal_id FROM journal_scopus_authors
      WHERE journal_id IN (?) AND employee_id = ?`,
    [journalIds, employeeId],
  );
  const keep = new Set(stillCredited.map((row) => row.journal_id));
  const [authorRows] = await connection.query('SELECT id FROM authors WHERE employee_id = ?', [
    employeeId,
  ]);
  const authorIds = authorRows.map((row) => row.id);

  for (const position of positions) {
    if (!position.imported || keep.has(position.journal_id)) continue;
    if (authorIds.length > 0) {
      await connection.query(
        'DELETE FROM author_journal WHERE journal_id = ? AND author_id IN (?)',
        [position.journal_id, authorIds],
      );
    }
    const [[journal]] = await connection.query(
      'SELECT external_details FROM journals WHERE id = ? FOR UPDATE',
      [position.journal_id],
    );
    const external = parseJsonArray(journal?.external_details);
    if (!external) continue;
    external.push({
      name: position.author_name,
      department: '',
      organization: KSRCT_ORGANIZATION,
      country: 'India',
      state: '',
      is_first_author: position.author_position === 1,
      is_primary: false,
      scopus_author_id: scopusId,
    });
    await connection.query('UPDATE journals SET external_details = ? WHERE id = ?', [
      JSON.stringify(external),
      position.journal_id,
    ]);
  }
  return journalIds.length;
};
