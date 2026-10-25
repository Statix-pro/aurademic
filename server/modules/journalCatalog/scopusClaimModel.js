import {
  creditScopusIds,
  loadStaffScopusIds,
  SCOPUS_AUTHOR_ID,
  uncreditScopusId,
} from './scopusCredit.js';
import { scopusNameMatches } from './values.js';
import db from '../../config/connection.js';

const MAX_SUGGESTIONS = 20;
const SAMPLE_PAPERS = 3;

const httpError = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const employeeName = `TRIM(CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')))`;

/**
 * The staff record a signed-in user is: their login's email, read from `users` by id rather
 * than from the token, matched to the staff email — the same link `v_authors` uses.
 */
const findStaffForUser = async (executor, userId, { lock = false } = {}) => {
  if (!userId) return null;
  const [rows] = await executor.query(
    `SELECT e.id, e.erp_id, e.scopus_id, ${employeeName} AS name
       FROM users u JOIN master_employees e ON e.email = u.email
      WHERE u.id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [userId],
  );
  return rows[0] ?? null;
};

/**
 * Scopus profiles that may be this staff member's: KSRCT authors of imported papers whose
 * Scopus ID nobody holds and whose name could be theirs. Only these can be claimed, so a
 * claim never takes a profile from someone else or reaches one with a different name.
 */
const findSuggestions = async (executor, staff, held) => {
  const [candidates] = await executor.query(
    `SELECT CAST(scopus_author_id AS CHAR) AS scopus_author_id, author_name,
            COUNT(DISTINCT journal_id) AS papers
       FROM journal_scopus_authors
      WHERE is_ksrct = 1 AND employee_id IS NULL AND scopus_author_id IS NOT NULL
      GROUP BY scopus_author_id, author_name`,
  );

  const byId = new Map();
  for (const candidate of candidates) {
    if (held.has(candidate.scopus_author_id)) continue;
    if (!scopusNameMatches(staff.name, candidate.author_name)) continue;
    const entry = byId.get(candidate.scopus_author_id) ?? {
      scopusAuthorId: candidate.scopus_author_id,
      names: [],
      papers: 0,
    };
    entry.names.push(candidate.author_name);
    entry.papers += Number(candidate.papers);
    byId.set(candidate.scopus_author_id, entry);
  }
  return [...byId.values()].sort((a, b) => b.papers - a.papers).slice(0, MAX_SUGGESTIONS);
};

/** A few papers per profile, so the staff member can recognise their own work. */
const attachSamples = async (executor, profiles) => {
  if (profiles.length === 0) return profiles;
  const [rows] = await executor.query(
    `SELECT CAST(s.scopus_author_id AS CHAR) AS scopus_author_id, j.title, j.year,
            COALESCE(jo.journal_name, '') AS source
       FROM journal_scopus_authors s
       JOIN journals j ON j.id = s.journal_id
       LEFT JOIN journal_options jo ON jo.id = j.journal_options_id
      WHERE s.scopus_author_id IN (?) AND s.is_ksrct = 1
      ORDER BY j.year DESC, j.id DESC`,
    [profiles.map((profile) => profile.scopusAuthorId)],
  );
  const samples = new Map();
  for (const row of rows) {
    const list = samples.get(row.scopus_author_id) ?? [];
    if (list.length < SAMPLE_PAPERS)
      list.push({ title: row.title, year: row.year, source: row.source });
    samples.set(row.scopus_author_id, list);
  }
  return profiles.map((profile) => ({
    ...profile,
    samples: samples.get(profile.scopusAuthorId) ?? [],
  }));
};

const scopusClaimModel = {
  /** Every further Scopus ID on file, for the super admin to review and undo. */
  async listClaims({ search, page, perPage }) {
    const where = [];
    const params = [];
    if (search) {
      where.push(
        `(${employeeName} LIKE ? OR e.erp_id LIKE ? OR CAST(x.scopus_author_id AS CHAR) = ?)`,
      );
      params.push(`%${search}%`, `%${search}%`, search);
    }
    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [[[{ total }]], [rows]] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS total FROM employee_scopus_ids x
           JOIN master_employees e ON e.id = x.employee_id ${clause}`,
        params,
      ),
      db.query(
        `SELECT x.id, CAST(x.scopus_author_id AS CHAR) AS scopus_author_id, x.source,
                x.created_at, u.name AS created_by_name, e.erp_id, ${employeeName} AS staff_name,
                (SELECT COUNT(DISTINCT s.journal_id) FROM journal_scopus_authors s
                  WHERE s.scopus_author_id = x.scopus_author_id AND s.employee_id = x.employee_id
                ) AS papers
           FROM employee_scopus_ids x
           JOIN master_employees e ON e.id = x.employee_id
           LEFT JOIN users u ON u.id = x.created_by
           ${clause}
          ORDER BY x.created_at DESC, x.id DESC
          LIMIT ? OFFSET ?`,
        [...params, perPage, (page - 1) * perPage],
      ),
    ]);
    return {
      rows: rows.map((row) => ({ ...row, papers: Number(row.papers) })),
      total: Number(total),
    };
  },

  /**
   * Takes a Scopus ID off a staff member — a wrong claim or a sheet typo — and with it the
   * imported papers it credited them with. Their main ID goes too when it is the same number.
   */
  async removeClaim(claimId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [[claim]] = await connection.query(
        `SELECT id, employee_id, CAST(scopus_author_id AS CHAR) AS scopus_author_id
           FROM employee_scopus_ids WHERE id = ? FOR UPDATE`,
        [claimId],
      );
      if (!claim) throw httpError(404, 'Scopus ID not found.');

      await connection.query('DELETE FROM employee_scopus_ids WHERE id = ?', [claim.id]);
      await connection.query(
        `UPDATE master_employees SET scopus_id = NULL WHERE id = ? AND TRIM(scopus_id) = ?`,
        [claim.employee_id, claim.scopus_author_id],
      );
      const papers = await uncreditScopusId(connection, claim.employee_id, claim.scopus_author_id);

      await connection.commit();
      return { papers };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /** The signed-in staff member's Scopus IDs and the profiles they may claim. */
  async getStaffProfiles(userId) {
    const staff = await findStaffForUser(db, userId);
    if (!staff) return { staff: null, yours: [], suggestions: [] };

    const { byScopusId, conflicts } = await loadStaffScopusIds(db);
    const held = new Set([...byScopusId.keys(), ...conflicts]);
    const yourIds = [...byScopusId.values()]
      .filter((row) => row.id === staff.id)
      .map((row) => row.scopus_id);

    let yours = [];
    if (yourIds.length > 0) {
      const [counts] = await db.query(
        `SELECT CAST(scopus_author_id AS CHAR) AS scopus_author_id, COUNT(DISTINCT journal_id) AS papers
           FROM journal_scopus_authors
          WHERE scopus_author_id IN (?) AND employee_id = ?
          GROUP BY scopus_author_id`,
        [yourIds, staff.id],
      );
      const papers = new Map(counts.map((row) => [row.scopus_author_id, Number(row.papers)]));
      yours = yourIds.map((id) => ({ scopusAuthorId: id, papers: papers.get(id) ?? 0 }));
    }

    const suggestions = await attachSamples(db, await findSuggestions(db, staff, held));
    return { staff: { name: staff.name, erpId: staff.erp_id }, yours, suggestions };
  },

  /**
   * The signed-in staff member confirms a suggested profile as theirs. It counts at once — the
   * college's decision — and records who claimed it and when, so a super admin can undo it.
   */
  async claimForStaff(userId, scopusAuthorId) {
    if (!SCOPUS_AUTHOR_ID.test(String(scopusAuthorId ?? ''))) {
      throw httpError(400, 'Choose a Scopus profile to confirm.');
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const staff = await findStaffForUser(connection, userId, { lock: true });
      if (!staff) {
        throw httpError(
          403,
          'Your login is not linked to a staff record, so there is nothing to claim for.',
        );
      }

      const { byScopusId, conflicts } = await loadStaffScopusIds(connection);
      const held = new Set([...byScopusId.keys(), ...conflicts]);
      const suggestions = await findSuggestions(connection, staff, held);
      if (!suggestions.some((profile) => profile.scopusAuthorId === String(scopusAuthorId))) {
        throw httpError(
          409,
          'This Scopus profile is not one suggested for you, or someone has already claimed it.',
        );
      }

      try {
        await connection.query(
          `INSERT INTO employee_scopus_ids (employee_id, scopus_author_id, source, created_by)
           VALUES (?, ?, 'self_claim', ?)`,
          [staff.id, scopusAuthorId, userId],
        );
      } catch (error) {
        // Two staff confirming the same profile at once: the unique key settles it.
        if (error.code === 'ER_DUP_ENTRY') {
          throw httpError(409, 'Someone has just claimed this Scopus profile.');
        }
        throw error;
      }
      if (!String(staff.scopus_id ?? '').trim()) {
        await connection.query('UPDATE master_employees SET scopus_id = ? WHERE id = ?', [
          String(scopusAuthorId),
          staff.id,
        ]);
      }
      const papers = await creditScopusIds(connection, staff.id, [String(scopusAuthorId)]);

      await connection.commit();
      return { papers };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },
};

export default scopusClaimModel;
