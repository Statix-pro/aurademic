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

/**
 * Links a staff member to a paper unless any of their `authors` rows already is — the form can
 * have credited them through another row. Returns whether this call made the link, which is
 * what an undo may take back.
 */
export const linkStaffAuthor = async (
  connection,
  { authorId, employeeId, journalId, firstAuthor },
) => {
  const [existing] = await connection.query(
    `SELECT 1 FROM author_journal aj JOIN authors a ON a.id = aj.author_id
      WHERE aj.journal_id = ? AND a.employee_id = ? LIMIT 1`,
    [journalId, employeeId],
  );
  if (existing.length > 0) return false;
  await connection.query(
    `INSERT INTO author_journal (author_id, journal_id, is_first_author, is_primary)
     VALUES (?, ?, ?, 0)`,
    [authorId, journalId, firstAuthor ? 1 : 0],
  );
  return true;
};

const groupByJournal = (positions) => {
  const byJournal = new Map();
  for (const position of positions) {
    if (!byJournal.has(position.journal_id)) byJournal.set(position.journal_id, []);
    byJournal.get(position.journal_id).push(position);
  }
  return byJournal;
};

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
  const byJournal = groupByJournal(positions);
  for (const [journalId, onPaper] of byJournal) {
    const linked = await linkStaffAuthor(connection, {
      authorId,
      employeeId,
      journalId,
      firstAuthor: onPaper.some((position) => position.author_position === 1),
    });
    await connection.query(
      'UPDATE journal_scopus_authors SET employee_id = ?, linked_by_import = ? WHERE id IN (?)',
      [employeeId, linked ? 1 : 0, onPaper.map((position) => position.id)],
    );
  }

  const ids = new Set(scopusIds.map(String));
  const [journals] = await connection.query(
    'SELECT id, external_details FROM journals WHERE id IN (?) FOR UPDATE',
    [[...byJournal.keys()]],
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
  return byJournal.size;
};

/**
 * Undoes `creditScopusIds` for one ID: its positions go back to unassigned. The staff member
 * comes off a paper only where the import or a claim made that link and no other of their IDs
 * still credits them there; a credit someone gave on the form stays. On a paper the import
 * created, the author goes back on its external list.
 */
export const uncreditScopusId = async (connection, employeeId, scopusId) => {
  const [positions] = await connection.query(
    `SELECT s.id, s.journal_id, s.author_position, s.author_name, s.linked_by_import,
            j.import_batch_id IS NOT NULL AS imported
       FROM journal_scopus_authors s
       JOIN journals j ON j.id = s.journal_id
      WHERE s.scopus_author_id = ? AND s.employee_id = ?
      FOR UPDATE`,
    [scopusId, employeeId],
  );
  if (positions.length === 0) return 0;

  await connection.query(
    'UPDATE journal_scopus_authors SET employee_id = NULL, linked_by_import = 0 WHERE id IN (?)',
    [positions.map((position) => position.id)],
  );

  const byJournal = groupByJournal(positions);
  const [remaining] = await connection.query(
    `SELECT id, journal_id FROM journal_scopus_authors
      WHERE journal_id IN (?) AND employee_id = ?`,
    [[...byJournal.keys()], employeeId],
  );
  const [authorRows] = await connection.query('SELECT id FROM authors WHERE employee_id = ?', [
    employeeId,
  ]);
  const authorIds = authorRows.map((row) => row.id);

  for (const [journalId, removed] of byJournal) {
    const madeLink = removed.some((position) => Number(position.linked_by_import) === 1);
    const stillThere = remaining.filter((row) => row.journal_id === journalId);
    if (stillThere.length > 0) {
      // Another of their IDs still credits them here; that ID now owns the link.
      if (madeLink) {
        await connection.query(
          'UPDATE journal_scopus_authors SET linked_by_import = 1 WHERE id IN (?)',
          [stillThere.map((row) => row.id)],
        );
      }
      continue;
    }
    if (madeLink && authorIds.length > 0) {
      await connection.query(
        'DELETE FROM author_journal WHERE journal_id = ? AND author_id IN (?)',
        [journalId, authorIds],
      );
    }
    if (!Number(removed[0].imported)) continue;

    const [[journal]] = await connection.query(
      'SELECT external_details FROM journals WHERE id = ? FOR UPDATE',
      [journalId],
    );
    const external = parseJsonArray(journal?.external_details);
    if (!external) continue;
    for (const position of removed) {
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
    }
    await connection.query('UPDATE journals SET external_details = ? WHERE id = ?', [
      JSON.stringify(external),
      journalId,
    ]);
  }
  return byJournal.size;
};
