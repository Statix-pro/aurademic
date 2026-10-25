import { creditScopusIds, loadStaffScopusIds } from './scopusCredit.js';
import db from '../../config/connection.js';

const truncate = (text, length) =>
  text && text.length > length ? `${text.slice(0, length - 1)}…` : text;

const httpError = (statusCode, message, details) =>
  Object.assign(new Error(message), { statusCode, details });

const employeeName = `TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')))`;

/** Imported papers each Scopus ID is an uncredited KSRCT author on. */
const loadUnassignedCounts = async (executor) => {
  const [rows] = await executor.query(
    `SELECT CAST(scopus_author_id AS CHAR) AS scopus_author_id, COUNT(DISTINCT journal_id) AS papers
       FROM journal_scopus_authors
      WHERE is_ksrct = 1 AND employee_id IS NULL AND scopus_author_id IS NOT NULL
      GROUP BY scopus_author_id`,
  );
  return new Map(rows.map((row) => [row.scopus_author_id, Number(row.papers)]));
};

/**
 * Adds one sheet row's IDs to its staff member and credits their papers, re-checked against
 * the staff list and the IDs on file as they are now.
 */
const applyStaffPayload = async (connection, payload, userId) => {
  const [[employee]] = await connection.query(
    `SELECT e.id, e.scopus_id, ${employeeName} AS name
       FROM master_employees e WHERE UPPER(TRIM(e.erp_id)) = ? FOR UPDATE`,
    [
      String(payload.erpId ?? '')
        .trim()
        .toUpperCase(),
    ],
  );
  if (!employee) return { skipped: `No staff member has ERP ID "${payload.erpId}"` };
  if (payload.scopusIds.length === 0) return { skipped: 'No valid Scopus Author ID on the row' };

  const { byScopusId, conflicts } = await loadStaffScopusIds(connection);
  const newIds = [];
  for (const id of payload.scopusIds) {
    const holder = byScopusId.get(id);
    if (conflicts.has(id) || (holder && holder.id !== employee.id)) {
      return { skipped: `Scopus ID ${id} is on file for ${holder?.name ?? 'two staff members'}` };
    }
    if (!holder) newIds.push(id);
  }

  if (newIds.length > 0) {
    await connection.query(
      'INSERT INTO employee_scopus_ids (employee_id, scopus_author_id, source, created_by) VALUES ?',
      [newIds.map((id) => [employee.id, id, 'admin_sheet', userId])],
    );
  }
  // The staff record's own field is the main ID the profile screens show; it is only filled.
  if (!String(employee.scopus_id ?? '').trim()) {
    await connection.query('UPDATE master_employees SET scopus_id = ? WHERE id = ?', [
      payload.scopusIds[0],
      employee.id,
    ]);
  }
  const papers = await creditScopusIds(connection, employee.id, payload.scopusIds);
  return { employeeId: employee.id, papers };
};

const lockBatch = async (connection, batchId, status, message) => {
  const [[batch]] = await connection.query(
    'SELECT id, status FROM journal_import_batches WHERE id = ? FOR UPDATE',
    [batchId],
  );
  if (!batch) throw httpError(404, 'Import not found.');
  if (batch.status !== status) throw httpError(409, message(batch.status));
};

const markApplied = (connection, rowIds, userId) =>
  connection.query(
    `UPDATE journal_import_rows
        SET resolution = 'applied', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE id IN (?)`,
    [userId, rowIds],
  );

const staffIdImportModel = {
  /** What a sheet preview is planned against. */
  async loadStaffContext() {
    const [[employees], staffIds, unassigned] = await Promise.all([
      db.query(`SELECT e.id, e.erp_id, ${employeeName} AS name FROM master_employees e`),
      loadStaffScopusIds(db),
      loadUnassignedCounts(db),
    ]);
    return { employees, held: staffIds.byScopusId, conflicts: staffIds.conflicts, unassigned };
  },

  async applyBatch(batchId, userId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await lockBatch(
        connection,
        batchId,
        'previewed',
        (status) => `This import is already ${status}.`,
      );

      const [rows] = await connection.query(
        `SELECT id, outcome, payload FROM journal_import_rows
          WHERE batch_id = ? AND resolution = 'pending' AND outcome <> 'exception'
          ORDER BY id`,
        [batchId],
      );
      const result = { added: 0, updated: 0, unchanged: 0, notApplied: 0, papersCredited: 0 };
      const done = [];
      for (const row of rows) {
        if (row.outcome === 'unchanged') {
          done.push(row.id);
          result.unchanged += 1;
          continue;
        }
        const applied = await applyStaffPayload(connection, row.payload, userId);
        if (applied.skipped) {
          await connection.query(
            `UPDATE journal_import_rows SET outcome = 'exception', reason = ? WHERE id = ?`,
            [truncate(`Not applied: ${applied.skipped}`, 500), row.id],
          );
          result.notApplied += 1;
          continue;
        }
        done.push(row.id);
        result[row.outcome === 'update' ? 'updated' : 'added'] += 1;
        result.papersCredited += applied.papers;
      }
      if (done.length > 0) await markApplied(connection, done, userId);
      await connection.query(
        `UPDATE journal_import_batches
            SET status = 'applied', applied_by = ?, applied_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [userId, batchId],
      );

      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  async resolveExceptions(batchId, { rowIds, action }, userId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await lockBatch(
        connection,
        batchId,
        'applied',
        () => 'Apply the import before resolving its exceptions.',
      );

      const [rows] = await connection.query(
        `SELECT id, journal_name, payload FROM journal_import_rows
          WHERE batch_id = ? AND id IN (?) AND outcome = 'exception' AND resolution = 'pending'
          ORDER BY id FOR UPDATE`,
        [batchId, rowIds],
      );
      if (rows.length !== rowIds.length) {
        throw httpError(409, 'Some of the selected rows are not open exceptions of this import.');
      }

      if (action === 'exclude') {
        await connection.query(
          `UPDATE journal_import_rows
              SET resolution = 'excluded', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
            WHERE id IN (?)`,
          [userId, rowIds],
        );
        await connection.commit();
        return { excluded: rows.length };
      }

      const failures = [];
      for (const row of rows) {
        const applied = await applyStaffPayload(connection, row.payload, userId);
        if (applied.skipped) {
          failures.push({ rowId: row.id, journalName: row.journal_name, reason: applied.skipped });
        }
      }
      if (failures.length > 0) {
        throw httpError(409, 'Some rows could not be accepted; nothing was changed.', failures);
      }
      await markApplied(connection, rowIds, userId);

      await connection.commit();
      return { accepted: rows.length };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

export default staffIdImportModel;
