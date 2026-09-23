/**
 * Data access for the research-project aggregate.
 *
 * A project is loaded and saved as one unit: the form shows every section at
 * once, so splitting the write across per-section endpoints (the previous
 * design) left half-saved projects behind whenever one call failed. `saveProject`
 * writes the root row and every child table inside a single transaction.
 *
 * Uploaded files are moved to their final location by the controller before the
 * transaction opens; the model only records paths and reports which stored
 * files stopped being referenced so the controller can delete them after the
 * commit succeeds.
 */

import { DISBURSEMENT_SLOTS, PROJECT_DOCUMENT_TYPES } from './projectPayload.js';
import db from '../../config/connection.js';

/** Raised for input the pure normalizer cannot check without the database. */
export class ProjectValidationError extends Error {
  constructor(errors) {
    super('The project could not be saved because some fields need attention.');
    this.name = 'ProjectValidationError';
    this.errors = errors;
  }
}

const HOST_ORGANIZATION_NAME = 'K.S.Rangasamy College of Technology';

const PROJECT_COLUMNS = [
  'driven_by',
  'title',
  'project_cost',
  'duration_years',
  'duration_months',
  'duration_days',
  'funding_organization_id',
  'scheme_id',
  'collaborators_enabled',
  'financial_contribution_enabled',
  'finance_sharing_enabled',
  'presentation_enabled',
  'submitted_on',
  'submission_mode',
  'reference_number',
  'cfrd_copy_submitted',
  'cfrd_copy_submitted_on',
  'proposal_status',
  'presentation_date',
  'presentation_venue',
  'presentation_panelists',
  'result_mode',
  'result_date',
  'final_result',
  'sanction_date',
  'sanction_reference_no',
  'sanction_mode',
  'project_start_date',
  'project_closing_date',
  'project_status',
  'outcome_journal_articles',
  'outcome_conferences',
  'outcome_iprs',
  'outcome_products',
  'outcome_tech_transfers',
  'outcome_startups',
  'remarks',
];

/**
 * Resolves an investigator row to an `authors` id, creating the author (and for
 * students the `author_students` row) when this is the first time the person
 * appears. Faculty are keyed on `master_employees.erp_id` so the dashboards'
 * `v_authors` joins — which match people by their employee email — resolve.
 */
async function resolveInvestigatorAuthorId(connection, investigator, index) {
  const fail = (message) =>
    new ProjectValidationError([{ field: `investigators[${index}]`, message }]);

  if (investigator.member_type === 'faculty') {
    const [[employee]] = await connection.query(
      'SELECT id FROM master_employees WHERE erp_id = ? LIMIT 1',
      [investigator.identity_code],
    );
    if (!employee) {
      throw fail(`No faculty member found with ERP id ${investigator.identity_code}.`);
    }

    const [[existing]] = await connection.query(
      'SELECT id FROM authors WHERE employee_id = ? LIMIT 1',
      [employee.id],
    );
    if (existing) return existing.id;

    // Name, email, department and organization are derived from
    // master_employees through v_authors, so they stay NULL here.
    const [inserted] = await connection.query(
      "INSERT INTO authors (employee_id, designation) VALUES (?, 'faculty')",
      [employee.id],
    );
    return inserted.insertId;
  }

  if (investigator.member_type === 'student') {
    // The register number is optional on the form, and without it there is
    // nothing to key an `authors` row on: the row is stored inline and
    // `project_investigators.author_id` stays NULL for exactly this case.
    if (!investigator.identity_code) return null;

    const [[existingStudent]] = await connection.query(
      'SELECT id FROM author_students WHERE student_unique_id = ? LIMIT 1',
      [investigator.identity_code],
    );

    let studentId = existingStudent?.id;
    if (studentId) {
      await connection.query(
        'UPDATE author_students SET name = ?, department = ?, organization = ? WHERE id = ?',
        [
          investigator.name,
          investigator.department ?? '',
          investigator.organization ?? HOST_ORGANIZATION_NAME,
          studentId,
        ],
      );
    } else {
      const [inserted] = await connection.query(
        'INSERT INTO author_students (student_unique_id, name, department, organization) VALUES (?, ?, ?, ?)',
        [
          investigator.identity_code,
          investigator.name,
          investigator.department ?? '',
          investigator.organization ?? HOST_ORGANIZATION_NAME,
        ],
      );
      studentId = inserted.insertId;
    }

    const [[existingAuthor]] = await connection.query(
      'SELECT id FROM authors WHERE student_ref = ? LIMIT 1',
      [studentId],
    );
    if (existingAuthor) {
      await connection.query(
        'UPDATE authors SET name = ?, department = ?, organization = ?, country = ?, email = ? WHERE id = ?',
        [
          investigator.name,
          investigator.department,
          investigator.organization,
          investigator.country,
          investigator.email,
          existingAuthor.id,
        ],
      );
      return existingAuthor.id;
    }

    const [inserted] = await connection.query(
      `INSERT INTO authors (student_ref, designation, name, department, organization, country, email)
       VALUES (?, 'student', ?, ?, ?, ?, ?)`,
      [
        studentId,
        investigator.name,
        investigator.department,
        investigator.organization,
        investigator.country,
        investigator.email,
      ],
    );
    return inserted.insertId;
  }

  // External: there is no institutional key, so the person is identified by
  // name + organization. A near-duplicate creates a new author rather than
  // silently merging two different people.
  const [[existingExternal]] = await connection.query(
    `SELECT id FROM authors
      WHERE designation = 'external'
        AND name = ?
        AND COALESCE(organization, '') = COALESCE(?, '')
      LIMIT 1`,
    [investigator.name, investigator.organization],
  );

  if (existingExternal) {
    await connection.query(
      'UPDATE authors SET department = ?, country = ?, email = COALESCE(?, email) WHERE id = ?',
      [investigator.department, investigator.country, investigator.email, existingExternal.id],
    );
    return existingExternal.id;
  }

  const [inserted] = await connection.query(
    `INSERT INTO authors (designation, name, department, organization, country, email)
     VALUES ('external', ?, ?, ?, ?, ?)`,
    [
      investigator.name,
      investigator.department,
      investigator.organization,
      investigator.country,
      investigator.email,
    ],
  );
  return inserted.insertId;
}

/** Rejects a scheme that does not belong to the selected funding agency. */
async function assertSchemeBelongsToOrganization(connection, project) {
  if (!project.scheme_id) return;

  const [[scheme]] = await connection.query(
    'SELECT organization_id FROM project_schemes WHERE id = ? LIMIT 1',
    [project.scheme_id],
  );

  if (!scheme) {
    throw new ProjectValidationError([
      { field: 'scheme_id', message: 'The selected scheme no longer exists.' },
    ]);
  }
  if (scheme.organization_id !== project.funding_organization_id) {
    throw new ProjectValidationError([
      {
        field: 'scheme_id',
        message: 'The selected scheme belongs to a different funding agency.',
      },
    ]);
  }
}

/**
 * Resolves every investigator to an `authors` id before the project row is
 * written. Doing it first means a bad ERP id is rejected before anything is
 * inserted, so a failed save leaves no half-built project behind.
 */
async function resolveInvestigatorAuthorIds(connection, investigators) {
  const authorIds = [];

  for (const [index, investigator] of investigators.entries()) {
    authorIds.push(await resolveInvestigatorAuthorId(connection, investigator, index));
  }

  return authorIds;
}

async function replaceInvestigators(connection, projectId, investigators, authorIds) {
  await connection.query('DELETE FROM project_investigators WHERE project_id = ?', [projectId]);

  for (const [index, investigator] of investigators.entries()) {
    const authorId = authorIds[index];

    await connection.query(
      `INSERT INTO project_investigators
        (project_id, member_type, author_id, name, department, organization, country,
         is_principal, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        investigator.member_type,
        authorId,
        investigator.name,
        investigator.department,
        investigator.organization,
        investigator.country,
        investigator.is_principal,
        investigator.display_order,
      ],
    );
  }
}

async function replaceTags(connection, projectId, tags) {
  await connection.query('DELETE FROM project_tags WHERE project_id = ?', [projectId]);

  const rows = Object.entries(tags).flatMap(([tagType, values]) =>
    values.map((value) => [projectId, tagType, value]),
  );
  if (rows.length === 0) return;

  await connection.query('INSERT INTO project_tags (project_id, tag_type, tag_value) VALUES ?', [
    rows,
  ]);
}

async function replaceCollaborators(connection, projectId, collaborators) {
  await connection.query('DELETE FROM project_collaborators WHERE project_id = ?', [projectId]);
  if (collaborators.length === 0) return;

  await connection.query(
    `INSERT INTO project_collaborators
      (project_id, category, role, organization_id, organization_name, city, has_active_mou,
       contact_name, contact_designation, contact_email, display_order)
     VALUES ?`,
    [
      collaborators.map((row) => [
        projectId,
        row.category,
        row.role,
        row.organization_id,
        row.organization_name,
        row.city,
        row.has_active_mou,
        row.contact_name,
        row.contact_designation,
        row.contact_email,
        row.display_order,
      ]),
    ],
  );
}

async function replaceFinanceRows(connection, projectId, financeRows) {
  // The heads junction cascades, so deleting the rows clears both tables.
  await connection.query('DELETE FROM project_finance_rows WHERE project_id = ?', [projectId]);

  for (const row of financeRows) {
    const [inserted] = await connection.query(
      `INSERT INTO project_finance_rows
        (project_id, row_type, organization_id, organization_name, amount, covers_all_heads,
         display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        row.row_type,
        row.organization_id,
        row.organization_name,
        row.amount,
        row.covers_all_heads,
        row.display_order,
      ],
    );

    if (row.heads.length === 0) continue;

    await connection.query(
      'INSERT INTO project_finance_row_heads (finance_row_id, budget_head_name) VALUES ?',
      [row.heads.map((head) => [inserted.insertId, head.budget_head_name])],
    );
  }
}

/**
 * Rewrites the project's applicable income heads — the ticks on the Income
 * Heads card. Nothing hangs off these rows, so the set is replaced wholesale.
 */
async function replaceIncomeHeads(connection, projectId, incomeHeads) {
  await connection.query('DELETE FROM project_income_heads WHERE project_id = ?', [projectId]);

  if (incomeHeads.length === 0) return;

  await connection.query(
    'INSERT INTO project_income_heads (project_id, income_head_name, display_order) VALUES ?',
    [incomeHeads.map((row) => [projectId, row.income_head_name, row.display_order])],
  );
}

/**
 * Rewrites the Budget Allotment matrix.
 *
 * Nothing hangs off these rows the way documents hang off a disbursement, so
 * the whole matrix is replaced rather than matched row by row. The cells arrive
 * addressed by the client's row/column keys, which are resolved here to the ids
 * the two header inserts produced.
 */
async function replaceBudgetAllotment(connection, projectId, budget) {
  // The cells cascade off both header tables, so deleting those clears all three.
  await connection.query('DELETE FROM project_budget_years WHERE project_id = ?', [projectId]);
  await connection.query('DELETE FROM project_budget_heads WHERE project_id = ?', [projectId]);

  const yearIdByKey = new Map();
  for (const row of budget.years) {
    const [inserted] = await connection.query(
      'INSERT INTO project_budget_years (project_id, financial_year, display_order) VALUES (?, ?, ?)',
      [projectId, row.financial_year, row.display_order],
    );
    yearIdByKey.set(row.key, inserted.insertId);
  }

  const headIdByKey = new Map();
  for (const row of budget.heads) {
    const [inserted] = await connection.query(
      `INSERT INTO project_budget_heads
        (project_id, budget_head_name, contribution_organization_id,
         contribution_organization_name, display_order)
       VALUES (?, ?, ?, ?, ?)`,
      [
        projectId,
        row.budget_head_name,
        row.contribution_organization_id,
        row.contribution_organization_name,
        row.display_order,
      ],
    );
    headIdByKey.set(row.key, inserted.insertId);
  }

  const cells = budget.allotments
    .map((cell) => [
      projectId,
      headIdByKey.get(cell.head_key),
      yearIdByKey.get(cell.year_key),
      cell.amount,
    ])
    .filter(([, headRowId, yearId]) => headRowId && yearId);

  if (cells.length === 0) return;

  await connection.query(
    `INSERT INTO project_budget_allotments
      (project_id, budget_head_row_id, budget_year_id, amount)
     VALUES ?`,
    [cells],
  );
}

/** Rewrites the transaction accounts and every ledger row under them. */
async function replaceTransactionAccounts(connection, projectId, accounts) {
  // `project_transactions.account_id` cascades, so this clears both tables.
  await connection.query('DELETE FROM project_transaction_accounts WHERE project_id = ?', [
    projectId,
  ]);

  for (const account of accounts) {
    const [inserted] = await connection.query(
      `INSERT INTO project_transaction_accounts
        (project_id, account_option_id, account_name, display_order)
       VALUES (?, ?, ?, ?)`,
      [projectId, account.account_option_id, account.account_name, account.display_order],
    );

    if (account.transactions.length === 0) continue;

    await connection.query(
      `INSERT INTO project_transactions
        (project_id, account_id, financial_year, transaction_date, head_kind,
         head_name, particulars, reference_no, payment_mode,
         contribution_organization_id, contribution_organization_name,
         credit, debit, counts_as_actual, display_order)
       VALUES ?`,
      [
        account.transactions.map((row) => [
          projectId,
          inserted.insertId,
          row.financial_year,
          row.transaction_date,
          row.head_kind,
          row.head_name,
          row.particulars,
          row.reference_no,
          row.payment_mode,
          row.contribution_organization_id,
          row.contribution_organization_name,
          row.credit,
          row.debit,
          row.counts_as_actual,
          row.display_order,
        ]),
      ],
    );
  }
}

/**
 * Disbursements are matched by id rather than replaced, so the document rows
 * that hang off a tranche survive an edit to its amount or date.
 * Returns a map from the client's row key to the stored row id, plus the paths
 * of files that belonged to tranches the user deleted.
 */
async function upsertDisbursements(connection, projectId, disbursements) {
  const [existingRows] = await connection.query(
    'SELECT id FROM project_grant_disbursements WHERE project_id = ?',
    [projectId],
  );
  const existingIds = new Set(existingRows.map((row) => row.id));

  const rowIdByKey = new Map();
  const keptIds = new Set();

  for (const row of disbursements) {
    const values = [
      row.financial_year,
      row.organization_id,
      row.organization_name,
      row.amount,
      row.disbursement_date,
      row.display_order,
    ];

    if (row.id && existingIds.has(row.id)) {
      await connection.query(
        `UPDATE project_grant_disbursements
            SET financial_year = ?, organization_id = ?, organization_name = ?, amount = ?,
                disbursement_date = ?, display_order = ?
          WHERE id = ? AND project_id = ?`,
        [...values, row.id, projectId],
      );
      keptIds.add(row.id);
      rowIdByKey.set(row.key, row.id);
      continue;
    }

    const [inserted] = await connection.query(
      `INSERT INTO project_grant_disbursements
        (project_id, financial_year, organization_id, organization_name, amount,
         disbursement_date, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectId, ...values],
    );
    rowIdByKey.set(row.key, inserted.insertId);
  }

  const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
  const staleFilePaths = [];

  if (removedIds.length > 0) {
    const [documents] = await connection.query(
      'SELECT file_path FROM project_documents WHERE disbursement_id IN (?)',
      [removedIds],
    );
    staleFilePaths.push(...documents.map((document) => document.file_path));

    await connection.query('DELETE FROM project_grant_disbursements WHERE id IN (?)', [removedIds]);
  }

  return { rowIdByKey, staleFilePaths };
}

/** Clears a document slot and returns the stored path, if any. */
async function clearDocumentSlot(connection, { projectId, disbursementId, documentType }) {
  const where =
    disbursementId === null
      ? 'project_id = ? AND document_type = ? AND disbursement_id IS NULL'
      : 'disbursement_id = ? AND document_type = ?';
  const params =
    disbursementId === null ? [projectId, documentType] : [disbursementId, documentType];

  const [existing] = await connection.query(
    `SELECT id, file_path FROM project_documents WHERE ${where}`,
    params,
  );
  if (existing.length === 0) return [];

  await connection.query(`DELETE FROM project_documents WHERE id IN (?)`, [
    existing.map((row) => row.id),
  ]);
  return existing.map((row) => row.file_path);
}

async function writeDocuments(connection, { projectId, aggregate, documents, rowIdByKey, userId }) {
  const staleFilePaths = [];
  const orphanFilePaths = [];

  for (const documentType of aggregate.removedDocuments) {
    staleFilePaths.push(
      ...(await clearDocumentSlot(connection, { projectId, disbursementId: null, documentType })),
    );
  }

  for (const row of aggregate.disbursements) {
    const disbursementId = rowIdByKey.get(row.key);
    if (!disbursementId) continue;

    for (const slot of row.removed_documents) {
      staleFilePaths.push(
        ...(await clearDocumentSlot(connection, {
          projectId,
          disbursementId,
          documentType: DISBURSEMENT_SLOTS[slot],
        })),
      );
    }
  }

  for (const document of documents) {
    let disbursementId = null;

    if (document.scope === 'disbursement') {
      disbursementId = rowIdByKey.get(document.rowKey) ?? null;
      if (!disbursementId) {
        // The tranche the file was attached to was removed in the same save.
        orphanFilePaths.push(document.file_path);
        continue;
      }
    }

    staleFilePaths.push(
      ...(await clearDocumentSlot(connection, {
        projectId,
        disbursementId,
        documentType: document.documentType,
      })),
    );

    await connection.query(
      `INSERT INTO project_documents
        (project_id, disbursement_id, document_type, file_path, original_name, file_size,
         mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        disbursementId,
        document.documentType,
        document.file_path,
        document.original_name,
        document.file_size,
        document.mime_type,
        userId ?? null,
      ],
    );
  }

  return { staleFilePaths, orphanFilePaths };
}

const projectModel = {
  /**
   * Creates or replaces a project and all of its child rows in one transaction.
   *
   * @param {object}   params
   * @param {?number}  params.projectId  existing project, or null to create one
   * @param {object}   params.aggregate  output of `normalizeProjectPayload`
   * @param {object[]} params.documents  files already moved into `uploads/`
   * @param {?number}  params.userId     writer, recorded on the row
   * @returns {Promise<{projectId: number, staleFilePaths: string[]}>}
   *   `staleFilePaths` are stored files no longer referenced; delete them only
   *   after the returned promise resolves, since the transaction has committed.
   */
  async saveProject({ projectId = null, aggregate, documents = [], userId = null }) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      await assertSchemeBelongsToOrganization(connection, aggregate.project);
      const authorIds = await resolveInvestigatorAuthorIds(connection, aggregate.investigators);

      const values = PROJECT_COLUMNS.map((column) => aggregate.project[column]);
      let savedId = projectId;

      if (savedId) {
        const [result] = await connection.query(
          `UPDATE research_projects
              SET ${PROJECT_COLUMNS.map((column) => `${column} = ?`).join(', ')}, updated_by = ?
            WHERE id = ?`,
          [...values, userId, savedId],
        );

        if (result.affectedRows === 0) {
          const error = new Error('Project not found.');
          error.statusCode = 404;
          throw error;
        }
      } else {
        const [result] = await connection.query(
          `INSERT INTO research_projects (${PROJECT_COLUMNS.join(', ')}, created_by, updated_by)
           VALUES (${PROJECT_COLUMNS.map(() => '?').join(', ')}, ?, ?)`,
          [...values, userId, userId],
        );
        savedId = result.insertId;
      }

      await replaceInvestigators(connection, savedId, aggregate.investigators, authorIds);
      await replaceTags(connection, savedId, aggregate.tags);
      await replaceCollaborators(connection, savedId, aggregate.collaborators);
      await replaceFinanceRows(connection, savedId, aggregate.financeRows);
      await replaceIncomeHeads(connection, savedId, aggregate.incomeHeads);
      await replaceBudgetAllotment(connection, savedId, aggregate.budget);
      await replaceTransactionAccounts(connection, savedId, aggregate.transactionAccounts);

      const { rowIdByKey, staleFilePaths: disbursementStale } = await upsertDisbursements(
        connection,
        savedId,
        aggregate.disbursements,
      );

      const { staleFilePaths, orphanFilePaths } = await writeDocuments(connection, {
        projectId: savedId,
        aggregate,
        documents,
        rowIdByKey,
        userId,
      });

      await connection.commit();

      return {
        projectId: savedId,
        staleFilePaths: [...disbursementStale, ...staleFilePaths, ...orphanFilePaths].filter(
          Boolean,
        ),
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  /** Loads the full aggregate in the shape the form consumes. */
  async getProjectById(projectId) {
    // Date columns are formatted in SQL rather than returned as driver Date
    // objects: serializing those to JSON converts local midnight to UTC, which
    // shifts the day backwards for any timezone ahead of UTC.
    const [[project]] = await db.query(
      `SELECT
          rp.id,
          rp.driven_by,
          rp.title,
          rp.project_cost,
          rp.duration_years,
          rp.duration_months,
          rp.duration_days,
          rp.funding_organization_id,
          rp.scheme_id,
          rp.collaborators_enabled,
          rp.financial_contribution_enabled,
          rp.finance_sharing_enabled,
          rp.presentation_enabled,
          DATE_FORMAT(rp.submitted_on, '%Y-%m-%d') AS submitted_on,
          rp.submission_mode,
          rp.reference_number,
          rp.cfrd_copy_submitted,
          DATE_FORMAT(rp.cfrd_copy_submitted_on, '%Y-%m-%d') AS cfrd_copy_submitted_on,
          rp.proposal_status,
          DATE_FORMAT(rp.presentation_date, '%Y-%m-%d') AS presentation_date,
          rp.presentation_venue,
          rp.presentation_panelists,
          rp.result_mode,
          DATE_FORMAT(rp.result_date, '%Y-%m-%d') AS result_date,
          rp.final_result,
          DATE_FORMAT(rp.sanction_date, '%Y-%m-%d') AS sanction_date,
          rp.sanction_reference_no,
          rp.sanction_mode,
          DATE_FORMAT(rp.project_start_date, '%Y-%m-%d') AS project_start_date,
          DATE_FORMAT(rp.project_closing_date, '%Y-%m-%d') AS project_closing_date,
          rp.project_status,
          rp.outcome_journal_articles,
          rp.outcome_conferences,
          rp.outcome_iprs,
          rp.outcome_products,
          rp.outcome_tech_transfers,
          rp.outcome_startups,
          rp.remarks,
          rp.created_by,
          rp.updated_by,
          rp.created_at,
          rp.updated_at,
          org.name AS funding_organization_name,
          org.short_name AS funding_organization_short_name,
          org.website AS funding_organization_website,
          sch.name AS scheme_name,
          sch.domain AS scheme_domain,
          sch.category AS scheme_category,
          sch.website AS scheme_website
        FROM research_projects rp
        LEFT JOIN project_organizations org ON rp.funding_organization_id = org.id
        LEFT JOIN project_schemes sch ON rp.scheme_id = sch.id
       WHERE rp.id = ?`,
      [projectId],
    );

    if (!project) return null;

    const [
      investigators,
      tags,
      collaborators,
      financeRows,
      financeHeads,
      disbursements,
      documents,
      incomeHeads,
      budgetYears,
      budgetHeads,
      budgetAllotments,
      transactionAccounts,
      transactions,
    ] = await Promise.all([
      db.query(
        `SELECT
              pin.id, pin.member_type, pin.author_id, pin.is_principal,
              pin.display_order,
              COALESCE(NULLIF(pin.name, ''), va.author_name) AS name,
              COALESCE(NULLIF(pin.department, ''), va.department) AS department,
              COALESCE(NULLIF(pin.organization, ''), va.organization) AS organization,
              pin.country,
              va.erp_id AS identity_code,
              va.email
            FROM project_investigators pin
            LEFT JOIN v_authors va ON pin.author_id = va.author_id
           WHERE pin.project_id = ?
           ORDER BY pin.display_order, pin.id`,
        [projectId],
      ),
      db.query(
        'SELECT tag_type, tag_value FROM project_tags WHERE project_id = ? ORDER BY tag_value',
        [projectId],
      ),
      db.query(
        `SELECT pc.*, COALESCE(NULLIF(pc.organization_name, ''), org.name) AS organization_label
             FROM project_collaborators pc
             LEFT JOIN project_organizations org ON pc.organization_id = org.id
            WHERE pc.project_id = ?
            ORDER BY pc.display_order, pc.id`,
        [projectId],
      ),
      db.query(
        `SELECT pfr.*, COALESCE(NULLIF(pfr.organization_name, ''), org.name) AS organization_label
             FROM project_finance_rows pfr
             LEFT JOIN project_organizations org ON pfr.organization_id = org.id
            WHERE pfr.project_id = ?
            ORDER BY pfr.row_type, pfr.display_order, pfr.id`,
        [projectId],
      ),
      db.query(
        `SELECT frh.finance_row_id, frh.budget_head_name
             FROM project_finance_row_heads frh
             JOIN project_finance_rows pfr ON frh.finance_row_id = pfr.id
            WHERE pfr.project_id = ?
            ORDER BY frh.id`,
        [projectId],
      ),
      db.query(
        `SELECT pgd.id, pgd.financial_year, pgd.organization_id, pgd.organization_name,
                  pgd.amount, pgd.display_order,
                  DATE_FORMAT(pgd.disbursement_date, '%Y-%m-%d') AS disbursement_date,
                  COALESCE(NULLIF(pgd.organization_name, ''), org.name) AS organization_label
             FROM project_grant_disbursements pgd
             LEFT JOIN project_organizations org ON pgd.organization_id = org.id
            WHERE pgd.project_id = ?
            ORDER BY pgd.display_order, pgd.id`,
        [projectId],
      ),
      db.query(
        `SELECT id, disbursement_id, document_type, file_path, original_name, file_size, mime_type, uploaded_at
             FROM project_documents
            WHERE project_id = ?
            ORDER BY id`,
        [projectId],
      ),
      db.query(
        `SELECT income_head_name
             FROM project_income_heads
            WHERE project_id = ?
            ORDER BY display_order, id`,
        [projectId],
      ),
      db.query(
        `SELECT id, financial_year, display_order
             FROM project_budget_years
            WHERE project_id = ?
            ORDER BY display_order, id`,
        [projectId],
      ),
      db.query(
        `SELECT pbh.id, pbh.display_order, pbh.budget_head_name,
                  pbh.contribution_organization_id, pbh.contribution_organization_name,
                  COALESCE(NULLIF(pbh.contribution_organization_name, ''), org.name)
                    AS contribution_organization_label
             FROM project_budget_heads pbh
             LEFT JOIN project_organizations org
                    ON pbh.contribution_organization_id = org.id
            WHERE pbh.project_id = ?
            ORDER BY pbh.display_order, pbh.id`,
        [projectId],
      ),
      db.query(
        `SELECT budget_head_row_id, budget_year_id, amount
             FROM project_budget_allotments
            WHERE project_id = ?`,
        [projectId],
      ),
      db.query(
        `SELECT pta.id, pta.account_option_id, pta.display_order,
                  COALESCE(NULLIF(pta.account_name, ''), ao.account_name) AS account_name
             FROM project_transaction_accounts pta
             LEFT JOIN account_options ao ON pta.account_option_id = ao.id
            WHERE pta.project_id = ?
            ORDER BY pta.display_order, pta.id`,
        [projectId],
      ),
      db.query(
        `SELECT pt.id, pt.account_id, pt.financial_year, pt.head_kind,
                  pt.particulars, pt.reference_no, pt.payment_mode,
                  pt.contribution_organization_id, pt.contribution_organization_name,
                  COALESCE(NULLIF(pt.contribution_organization_name, ''), org.name)
                    AS contribution_organization_label,
                  pt.credit, pt.debit, pt.display_order,
                  pt.counts_as_actual,
                  DATE_FORMAT(pt.transaction_date, '%Y-%m-%d') AS transaction_date,
                  pt.head_name
             FROM project_transactions pt
             LEFT JOIN project_organizations org
                    ON pt.contribution_organization_id = org.id
            WHERE pt.project_id = ?
            ORDER BY pt.display_order, pt.id`,
        [projectId],
      ),
    ]);

    const headsByRow = financeHeads[0].reduce((map, head) => {
      const heads = map.get(head.finance_row_id) ?? [];
      heads.push({ budget_head_name: head.budget_head_name });
      map.set(head.finance_row_id, heads);
      return map;
    }, new Map());

    const documentRows = documents[0];
    const slotByDocumentType = Object.fromEntries(
      Object.entries(DISBURSEMENT_SLOTS).map(([slot, documentType]) => [documentType, slot]),
    );

    const projectDocuments = PROJECT_DOCUMENT_TYPES.reduce((map, documentType) => {
      const row = documentRows.find(
        (document) => document.disbursement_id === null && document.document_type === documentType,
      );
      if (row) map[documentType] = row;
      return map;
    }, {});

    return {
      ...project,
      investigators: investigators[0],
      national_initiatives: tags[0]
        .filter((tag) => tag.tag_type === 'national_initiative')
        .map((tag) => tag.tag_value),
      sdgs: tags[0].filter((tag) => tag.tag_type === 'sdg').map((tag) => tag.tag_value),
      collaborators: collaborators[0],
      financial_contributions: financeRows[0]
        .filter((row) => row.row_type === 'contribution')
        .map((row) => ({ ...row, heads: headsByRow.get(row.id) ?? [] })),
      finance_sharing: financeRows[0]
        .filter((row) => row.row_type === 'sharing')
        .map((row) => ({ ...row, heads: headsByRow.get(row.id) ?? [] })),
      disbursements: disbursements[0].map((row) => ({
        ...row,
        documents: documentRows
          .filter((document) => document.disbursement_id === row.id)
          .reduce((map, document) => {
            const slot = slotByDocumentType[document.document_type];
            if (slot) map[slot] = document;
            return map;
          }, {}),
      })),
      documents: projectDocuments,
      income_heads: incomeHeads[0].map((row) => row.income_head_name),
      budget: {
        years: budgetYears[0],
        heads: budgetHeads[0],
        // Cells are addressed by the two header ids; the form rebuilds its own
        // row/column keys from them on load.
        allotments: budgetAllotments[0],
      },
      transaction_accounts: transactionAccounts[0].map((account) => ({
        ...account,
        transactions: transactions[0].filter((row) => row.account_id === account.id),
      })),
    };
  },

  async doesProjectExist(projectId) {
    const [[row]] = await db.query('SELECT id FROM research_projects WHERE id = ? LIMIT 1', [
      projectId,
    ]);
    return Boolean(row);
  },

  /**
   * Tells the caller how the user relates to the project: only an investigator
   * (or an admin, decided by the controller) may edit it, and only the PI may
   * request edit access after approval.
   */
  async getProjectAccess(projectId, { userId, email }) {
    const [[row]] = await db.query(
      `SELECT
          rp.id,
          rp.created_by,
          MAX(CASE WHEN va.email = ? THEN 1 ELSE 0 END) AS is_investigator,
          MAX(CASE WHEN va.email = ? AND pin.is_principal = 1 THEN 1 ELSE 0 END) AS is_principal
        FROM research_projects rp
        LEFT JOIN project_investigators pin ON pin.project_id = rp.id
        LEFT JOIN v_authors va ON pin.author_id = va.author_id
       WHERE rp.id = ?
       GROUP BY rp.id, rp.created_by`,
      [email ?? null, email ?? null, projectId],
    );

    if (!row) return null;

    return {
      projectId: row.id,
      isOwner: row.created_by !== null && Number(row.created_by) === Number(userId),
      isInvestigator: Boolean(Number(row.is_investigator)),
      isPrincipalInvestigator: Boolean(Number(row.is_principal)),
    };
  },

  /** Deletes a project and returns the stored files that must be removed. */
  async deleteProject(projectId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [documents] = await connection.query(
        'SELECT file_path FROM project_documents WHERE project_id = ?',
        [projectId],
      );

      const [result] = await connection.query('DELETE FROM research_projects WHERE id = ?', [
        projectId,
      ]);

      await connection.commit();

      return {
        deleted: result.affectedRows > 0,
        staleFilePaths: documents.map((document) => document.file_path).filter(Boolean),
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  },

  // ==========================================================================
  // Lookups
  // ==========================================================================

  /**
   * Everything the form needs to render its dropdowns, in one round trip. The
   * lists are small master data (tens of rows), so paging them would only add
   * latency to the form's first paint.
   */
  async getFormLookups() {
    const [organizations, schemes, departments, accounts, budgetHeads] = await Promise.all([
      db.query(
        `SELECT id, name, short_name, category, city, state, country, website,
                is_funding_agency, is_internal
           FROM project_organizations
          WHERE is_active = 1
          ORDER BY is_internal DESC, sort_order, name`,
      ),
      db.query(
        `SELECT id, organization_id, name, domain, category, website
           FROM project_schemes
          WHERE is_active = 1
          ORDER BY sort_order, name`,
      ),
      db.query(
        `SELECT id, name, code FROM master_departments WHERE is_active = 1 ORDER BY sort_order, name`,
      ),
      // The Transaction tab's account dropdown, from the same list the finance
      // and expenditure screens use.
      db.query(
        `SELECT id, account_name AS name
           FROM account_options
          WHERE is_active = 1 AND is_deleted = 0
          ORDER BY sort_order, account_name`,
      ),
      // The budget-head vocabulary the form offers, curated in the admin. A
      // head retired there stays on the projects that already budget under it,
      // which store the name rather than a reference to this row.
      db.query(
        `SELECT id, name, head_group
           FROM project_budget_head_options
          WHERE is_active = 1
          ORDER BY head_group, sort_order, name`,
      ),
    ]);

    return {
      organizations: organizations[0],
      schemes: schemes[0],
      departments: departments[0],
      accounts: accounts[0],
      budgetHeads: budgetHeads[0],
    };
  },

  /**
   * Just the head names, for the save path: the normalizer uses them to store a
   * submitted head in its curated case, so `overhead charges` and
   * `Overhead Charges` do not become two heads on one project. Names only, and
   * every group's, since a head is stored by name whichever group offered it.
   */
  async listBudgetHeadNames() {
    const [rows] = await db.query(
      'SELECT DISTINCT name FROM project_budget_head_options WHERE is_active = 1',
    );
    return rows.map((row) => row.name);
  },

  async searchOrganizations(query, { fundingOnly = false, limit = 25 } = {}) {
    const filters = ['is_active = 1'];
    const params = [];

    if (fundingOnly) filters.push('is_funding_agency = 1');
    if (query) {
      filters.push('(name LIKE ? OR short_name LIKE ?)');
      params.push(`%${query}%`, `%${query}%`);
    }

    const [rows] = await db.query(
      `SELECT id, name, short_name, category, city, state, country, website, is_internal
         FROM project_organizations
        WHERE ${filters.join(' AND ')}
        ORDER BY is_internal DESC, sort_order, name
        LIMIT ?`,
      [...params, limit],
    );
    return rows;
  },

  async listSchemes({ organizationId = null, query = '', limit = 50 } = {}) {
    const filters = ['is_active = 1'];
    const params = [];

    if (organizationId) {
      filters.push('organization_id = ?');
      params.push(organizationId);
    }
    if (query) {
      filters.push('name LIKE ?');
      params.push(`%${query}%`);
    }

    const [rows] = await db.query(
      `SELECT id, organization_id, name, domain, category, website
         FROM project_schemes
        WHERE ${filters.join(' AND ')}
        ORDER BY sort_order, name
        LIMIT ?`,
      [...params, limit],
    );
    return rows;
  },

  // ==========================================================================
  // Master-data add requests ("Add Scheme" on the form)
  // ==========================================================================

  async createRequest(userId, request) {
    const [result] = await db.query(
      `INSERT INTO project_requests
        (user_id, request_type, name, organization_id, organization_name, domain, category,
         website, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        request.request_type,
        request.name,
        request.organization_id,
        request.organization_name,
        request.domain,
        request.category,
        request.website,
        request.description,
      ],
    );

    return this.getRequest(result.insertId);
  },

  async getRequest(requestId) {
    const [[row]] = await db.query(
      `SELECT pr.*, org.name AS parent_organization_name
         FROM project_requests pr
         LEFT JOIN project_organizations org ON pr.organization_id = org.id
        WHERE pr.id = ?`,
      [requestId],
    );
    return row ?? null;
  },

  async listUserRequests(userId) {
    const [rows] = await db.query(
      `SELECT pr.*, org.name AS parent_organization_name
         FROM project_requests pr
         LEFT JOIN project_organizations org ON pr.organization_id = org.id
        WHERE pr.user_id = ?
        ORDER BY pr.created_at DESC`,
      [userId],
    );
    return rows;
  },
};

export default projectModel;
