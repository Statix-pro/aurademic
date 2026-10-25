import { storedIssn } from './issn.js';
import { createLiveIndex, loadJournalSnapshot } from './journalCatalogModel.js';
import { FIELD_LIMITS, normalizeDoi, titleYearKey } from './paperPlanner.js';
import {
  dropExternalAuthors,
  ensureStaffAuthor,
  KSRCT_ORGANIZATION,
  linkStaffAuthor,
  loadStaffScopusIds,
} from './scopusCredit.js';
import { titlesMatch } from './values.js';
import db from '../../config/connection.js';
import { resolveOfficialQuartile, resolvePlaceholderOptionId } from '../journal/journalModel.js';

/**
 * National/International of a conference paper, book or chapter. Those have no journal in the
 * list to take a level from, and Scopus does not say; the publication form asks the author.
 */
const PLACEHOLDER_PAPER_LEVEL = 'International';

const FILL_COLUMNS = [
  'scopus_id',
  'doi',
  'year',
  'volume',
  'issue',
  'article_number',
  'pages_from',
  'pages_to',
  'abstract',
  'keywords',
  'open_access',
  'pubmed_pmid',
];

/**
 * The fill columns as a preview reads them: the planner only asks whether abstract and keywords
 * are empty, so those come back as a flag instead of every publication's full text.
 */
const PREVIEW_FILL_COLUMNS = FILL_COLUMNS.map((column) =>
  ['abstract', 'keywords'].includes(column)
    ? `IF(COALESCE(${column}, '') = '', NULL, 1) AS ${column}`
    : column,
).join(', ');

const isEmpty = (value) => value === null || value === undefined || String(value).trim() === '';

const truncate = (text, length) =>
  text && text.length > length ? `${text.slice(0, length - 1)}…` : text;

const httpError = (statusCode, message, details) =>
  Object.assign(new Error(message), { statusCode, details });

/**
 * Scopus writes each author's affiliation as "Name, department, organisation, city, country".
 * An external author is listed with that organisation and country, as the form asks for them.
 */
const externalAuthor = (author) => {
  if (author.ksrct) {
    return { organization: KSRCT_ORGANIZATION, country: 'India' };
  }
  const parts = author.affiliation
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { organization: '', country: '' };
  const country = parts.length > 2 ? parts[parts.length - 1] : '';
  const organization = parts.slice(1, parts.length > 2 ? -1 : undefined).join(', ');
  return { organization: truncate(organization, 255), country: truncate(country, 100) };
};

/** The state an apply works against, read inside its transaction and kept current. */
const loadLiveState = async (connection) => {
  const journals = createLiveIndex(await loadJournalSnapshot(connection, { lock: true }));
  const { byScopusId: employees } = await loadStaffScopusIds(connection);
  const [publications] = await connection.query(
    'SELECT id, TRIM(scopus_id) AS scopus_id, doi, title, year FROM journals',
  );
  const publicationsByScopusId = new Map();
  const publicationsByDoi = new Map();
  // Only publications that were in the portal before this apply: two papers of the same file
  // can share a title and year (a conference paper and its journal version).
  const publicationsByTitleYear = new Map();
  for (const row of publications) {
    if (row.scopus_id) publicationsByScopusId.set(row.scopus_id, row.id);
    const doi = normalizeDoi(row.doi);
    if (doi && !publicationsByDoi.has(doi)) publicationsByDoi.set(doi, row.id);
    const key = titleYearKey(row.title, row.year);
    if (!publicationsByTitleYear.has(key)) publicationsByTitleYear.set(key, row.id);
  }
  return {
    journals,
    employees,
    publicationsByScopusId,
    publicationsByDoi,
    publicationsByTitleYear,
    authorIdByEmployee: new Map(),
  };
};

/** The journal a paper being added goes on, checked against the list as it is now. */
const resolveJournalOption = async (connection, live, journal) => {
  if (journal.kind === 'placeholder') {
    return { id: await resolvePlaceholderOptionId(connection, journal.name), category: null };
  }

  let option = journal.journalOptionId ? live.journals.byId.get(journal.journalOptionId) : null;
  if (!option) {
    // Not in the list at preview time; it may have been imported since.
    const owners = new Set(
      journal.issns.map((issn) => live.journals.byIssn.get(storedIssn(issn))).filter(Boolean),
    );
    if (owners.size === 1) {
      const candidate = live.journals.byId.get([...owners][0]);
      if (titlesMatch(journal.name, candidate.journal_name)) option = candidate;
    }
  }
  if (!option) {
    return { skipped: `"${journal.name}" is not in the journal list` };
  }
  return { id: option.id, category: option.category };
};

/**
 * Credits the staff a paper's Scopus Author IDs point at, once each. Returns, per staff member,
 * whether this import made the link (rather than finding one the form already had), which is
 * what removing their Scopus ID later may take back.
 */
const creditStaff = async (connection, live, publicationId, authors) => {
  const linked = new Map();
  for (const author of authors) {
    if (!author.ksrct || !author.scopusAuthorId) continue;
    const employee = live.employees.get(author.scopusAuthorId);
    if (!employee || linked.has(employee.id)) continue;

    const authorId = await ensureStaffAuthor(connection, employee.id, live.authorIdByEmployee);
    linked.set(
      employee.id,
      await linkStaffAuthor(connection, {
        authorId,
        employeeId: employee.id,
        journalId: publicationId,
        firstAuthor: author.position === 1,
      }),
    );
  }
  return linked;
};

const saveScopusAuthors = async (connection, publicationId, authors, live, linked) => {
  if (authors.length === 0) return;
  // `linked_by_import` is assigned before `employee_id`: MySQL applies these left to right, so
  // the condition still sees whether the position was credited before this import.
  await connection.query(
    `INSERT INTO journal_scopus_authors
       (journal_id, author_position, scopus_author_id, author_name, is_ksrct, employee_id,
        linked_by_import)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       linked_by_import = IF(journal_scopus_authors.employee_id IS NULL,
                             VALUES(linked_by_import), journal_scopus_authors.linked_by_import),
       employee_id = COALESCE(journal_scopus_authors.employee_id, VALUES(employee_id))`,
    [
      authors.map((author) => {
        const employeeId =
          author.ksrct && author.scopusAuthorId
            ? (live.employees.get(author.scopusAuthorId)?.id ?? null)
            : null;
        return [
          publicationId,
          author.position,
          author.scopusAuthorId,
          truncate(author.name, 255),
          author.ksrct ? 1 : 0,
          employeeId,
          employeeId && linked.get(employeeId) ? 1 : 0,
        ];
      }),
    ],
  );
};

const addIndexes = async (connection, publicationId, payload) => {
  const wanted = ['Scopus', ...(payload.pubmed ? ['PubMed'] : [])];
  const [existing] = await connection.query(
    'SELECT index_name FROM journal_indexes WHERE journal_id = ?',
    [publicationId],
  );
  const has = new Set(existing.map((row) => String(row.index_name).toLowerCase()));
  const missing = wanted.filter((name) => !has.has(name.toLowerCase()));
  if (missing.length === 0) return;
  await connection.query('INSERT INTO journal_indexes (journal_id, index_name) VALUES ?', [
    missing.map((name) => [publicationId, name]),
  ]);
};

const addPaper = async (connection, live, payload, batchId, userId, { reviewed = false } = {}) => {
  const { publication } = payload;
  // Someone may have filed the paper on the form since the preview, often with a DOI and no
  // Scopus EID, sometimes with neither — so all three keys the preview matches on are checked.
  // An admin accepting a reviewed exception has already decided it is a separate paper (a
  // journal version of a conference paper shares its title and year), so for them only the
  // EID and DOI, which identify a paper, still stop it.
  const doi = normalizeDoi(publication.doi);
  const existingId =
    (publication.scopus_id && live.publicationsByScopusId.get(publication.scopus_id)) ||
    (doi && live.publicationsByDoi.get(doi)) ||
    (!reviewed &&
      live.publicationsByTitleYear.get(titleYearKey(publication.title, publication.year)));
  if (existingId) {
    return { skipped: `It is now in the portal as publication #${existingId}` };
  }

  // Accepting an exception does not make a long value fit; it is entered by hand instead.
  for (const [column, [label, limit]] of Object.entries(FIELD_LIMITS)) {
    const value = publication[column];
    if (value && String(value).length > limit) {
      return {
        skipped: `${label} is longer than ${limit} characters — enter this paper on the form`,
      };
    }
  }

  const option = await resolveJournalOption(connection, live, payload.journal);
  if (option.skipped) return option;

  const isCredited = (author) =>
    author.ksrct && author.scopusAuthorId && live.employees.has(author.scopusAuthorId);
  const externalDetails = payload.authors
    .filter((author) => !isCredited(author))
    .map((author) => ({
      name: author.name,
      department: '',
      ...externalAuthor(author),
      state: '',
      is_first_author: author.position === 1,
      is_primary: false,
      scopus_author_id: author.scopusAuthorId,
    }));

  const [inserted] = await connection.query('INSERT INTO journals SET ?', [
    {
      ...publication,
      publication_details: publication.publication_details
        ? JSON.stringify(publication.publication_details)
        : null,
      journal_options_id: option.id,
      category: option.category ?? PLACEHOLDER_PAPER_LEVEL,
      quartile: await resolveOfficialQuartile(
        connection,
        option.id,
        publication.type,
        publication.year,
      ),
      external_details: externalDetails.length > 0 ? JSON.stringify(externalDetails) : null,
      status: 'published',
      admin_approval_status: 'approved',
      admin_approved_by: userId,
      admin_approved_at: new Date(),
      driven_by: 'faculty',
      import_batch_id: batchId,
    },
  ]);
  const publicationId = inserted.insertId;
  if (publication.scopus_id) live.publicationsByScopusId.set(publication.scopus_id, publicationId);
  if (doi) live.publicationsByDoi.set(doi, publicationId);

  await addIndexes(connection, publicationId, payload);
  const linked = await creditStaff(connection, live, publicationId, payload.authors);
  await saveScopusAuthors(connection, publicationId, payload.authors, live, linked);
  return { publicationId, journalOptionId: option.id, action: 'added' };
};

/**
 * Fills a publication the portal already has. Blank fields only, and the author list a person
 * entered is left as it is — staff are added to it, nobody is taken off.
 */
const updatePaper = async (connection, live, payload) => {
  const [[current]] = await connection.query(
    `SELECT id, journal_options_id, ${FILL_COLUMNS.join(', ')}
       FROM journals WHERE id = ? FOR UPDATE`,
    [payload.publicationId],
  );
  if (!current) return { skipped: 'The publication has been deleted' };

  const updates = {};
  for (const [column, value] of Object.entries(payload.set)) {
    if (!FILL_COLUMNS.includes(column) || !isEmpty(current[column])) continue;
    if (column === 'scopus_id') {
      const owner = live.publicationsByScopusId.get(String(value));
      if (owner && owner !== current.id) continue;
      live.publicationsByScopusId.set(String(value), current.id);
    }
    updates[column] = value;
  }
  // `import_batch_id` stays as it is: it marks a publication an import created, which is how
  // removing a Scopus ID knows whose author list it may change.
  if (Object.keys(updates).length > 0) {
    await connection.query('UPDATE journals SET ? WHERE id = ?', [updates, current.id]);
  }

  await addIndexes(connection, current.id, payload);
  const linked = await creditStaff(connection, live, current.id, payload.authors);
  await saveScopusAuthors(connection, current.id, payload.authors, live, linked);
  // A paper imported before its author's Scopus ID was on file lists them as external.
  await dropExternalAuthors(
    connection,
    [current.id],
    payload.authors
      .filter((author) => author.ksrct && live.employees.has(author.scopusAuthorId ?? ''))
      .map((author) => author.scopusAuthorId),
  );
  return {
    publicationId: current.id,
    journalOptionId: current.journal_options_id,
    action: 'updated',
  };
};

const applyPaperPayload = (connection, live, payload, batchId, userId, options) =>
  payload.action === 'add'
    ? addPaper(connection, live, payload, batchId, userId, options)
    : updatePaper(connection, live, payload);

const markApplied = (connection, rowId, applied, userId) =>
  connection.query(
    `UPDATE journal_import_rows
        SET resolution = 'applied', publication_id = ?, journal_option_id = ?, resolved_by = ?,
            resolved_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [applied.publicationId, applied.journalOptionId, userId, rowId],
  );

const lockBatch = async (connection, batchId, status, message) => {
  const [[batch]] = await connection.query(
    'SELECT id, status FROM journal_import_batches WHERE id = ? FOR UPDATE',
    [batchId],
  );
  if (!batch) throw httpError(404, 'Import not found.');
  if (batch.status !== status) throw httpError(409, message(batch.status));
};

const paperImportModel = {
  /** What a paper preview is planned against: the portal's publications and staff Scopus IDs. */
  async loadPaperContext() {
    const [[publications], [links], [scopusAuthors], employees] = await Promise.all([
      db.query(`SELECT id, title, journal_options_id, ${PREVIEW_FILL_COLUMNS} FROM journals`),
      db.query(
        `SELECT aj.journal_id, a.employee_id
           FROM author_journal aj JOIN authors a ON a.id = aj.author_id
          WHERE a.employee_id IS NOT NULL`,
      ),
      db.query('SELECT DISTINCT journal_id FROM journal_scopus_authors'),
      loadStaffScopusIds(db),
    ]);

    const linked = new Map();
    for (const { journal_id: journalId, employee_id: employeeId } of links) {
      if (!linked.has(journalId)) linked.set(journalId, []);
      linked.get(journalId).push(employeeId);
    }
    const withScopusAuthors = new Set(scopusAuthors.map((row) => row.journal_id));

    return {
      publications: publications.map((publication) => ({
        ...publication,
        linkedEmployeeIds: linked.get(publication.id) ?? [],
        hasScopusAuthors: withScopusAuthors.has(publication.id),
      })),
      employees: employees.rows,
    };
  },

  /**
   * Adds and fills every planned paper of a previewed batch in one transaction. A paper that
   * can no longer be applied as planned (added by someone since, journal removed) becomes an
   * exception with the reason, as journal rows do.
   */
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

      const live = await loadLiveState(connection);
      const [rows] = await connection.query(
        `SELECT id, outcome, payload FROM journal_import_rows
          WHERE batch_id = ? AND resolution = 'pending' AND outcome <> 'exception'
          ORDER BY id`,
        [batchId],
      );

      const result = { added: 0, updated: 0, unchanged: 0, notApplied: 0 };
      const unchanged = [];
      for (const row of rows) {
        if (row.outcome === 'unchanged') {
          unchanged.push(row.id);
          result.unchanged += 1;
          continue;
        }
        const applied = await applyPaperPayload(connection, live, row.payload, batchId, userId);
        if (applied.skipped) {
          await connection.query(
            `UPDATE journal_import_rows SET outcome = 'exception', reason = ? WHERE id = ?`,
            [truncate(`Not applied: ${applied.skipped}`, 500), row.id],
          );
          result.notApplied += 1;
          continue;
        }
        await markApplied(connection, row.id, applied, userId);
        result[applied.action] += 1;
      }

      if (unchanged.length > 0) {
        await connection.query(
          `UPDATE journal_import_rows
              SET resolution = 'applied', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
            WHERE id IN (?)`,
          [userId, unchanged],
        );
      }
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

  /**
   * Accepts or excludes paper exceptions. Accepting applies each paper as planned against the
   * portal as it is now — so a paper whose journal was missing goes through once the journal
   * has been imported. If any of them still cannot be applied, none are.
   */
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

      const live = await loadLiveState(connection);
      const failures = [];
      for (const row of rows) {
        const applied = await applyPaperPayload(connection, live, row.payload, batchId, userId, {
          reviewed: true,
        });
        if (applied.skipped) {
          failures.push({ rowId: row.id, journalName: row.journal_name, reason: applied.skipped });
          continue;
        }
        await markApplied(connection, row.id, applied, userId);
      }
      if (failures.length > 0) {
        throw httpError(409, 'Some rows could not be accepted; nothing was changed.', failures);
      }

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

export default paperImportModel;
