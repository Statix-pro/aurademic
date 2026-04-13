/**
 * expenditureModel.js
 *
 * Data-access layer for Expenditure (Advance) requests.
 * Follows the same MySQL / mysql2 pool patterns as budgetModel.js and financeModel.js.
 * All writes that touch more than one table run inside a transaction.
 */

import db from '../../config/connection.js';
import { searchApplicant as searchEmployeeApplicants } from '../shared/budget/userResolvers.js';
import { normalizeBeneficiaryType, beneficiaryTypeToEntityTypeCode } from '../shared/budget/budgetUtils.js';

// ─── Utilities ────────────────────────────────────────────────────────────────

const normalizeText = (v) => String(v || '').trim();

const toPositiveInt = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const toMoney = (v) => {
  const n = Number(String(v || '').replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

async function resolveExpenditureWorkflowContext(conn, expenditureData = {}) {
  const beneficiaryType = normalizeBeneficiaryType(expenditureData.beneficiary_type);
  const entityTypeCode = beneficiaryTypeToEntityTypeCode(beneficiaryType);

  let departmentId = toPositiveInt(expenditureData.department_id);
  let beneficiaryEntityId = toPositiveInt(expenditureData.beneficiary_entity_id);
  const employeeId = toPositiveInt(expenditureData.employee_id);
  const beneficiaryValue = normalizeText(expenditureData.beneficiary_value);

  if (employeeId) {
    const [employeeRows] = await conn.execute(
      `SELECT department_id, entity_id
         FROM master_employees
        WHERE id = ?
          AND status = 'Active'
        LIMIT 1`,
      [employeeId],
    );

    if (employeeRows.length) {
      departmentId = departmentId || toPositiveInt(employeeRows[0].department_id);
      beneficiaryEntityId = beneficiaryEntityId || toPositiveInt(employeeRows[0].entity_id);
    }
  }

  if (!departmentId && beneficiaryType === 'Department' && beneficiaryValue) {
    const [departmentRows] = await conn.execute(
      `SELECT id
         FROM master_departments
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
        LIMIT 1`,
      [beneficiaryValue],
    );

    if (departmentRows.length) {
      departmentId = toPositiveInt(departmentRows[0].id);
    }
  }

  if (!beneficiaryEntityId && entityTypeCode && beneficiaryValue) {
    const [entityRows] = await conn.execute(
      `SELECT me.id
         FROM master_entities me
         JOIN master_entity_types met ON met.id = me.entity_type_id
        WHERE me.is_active = 1
          AND UPPER(TRIM(met.code)) = ?
          AND LOWER(TRIM(me.name)) = LOWER(TRIM(?))
        LIMIT 1`,
      [entityTypeCode, beneficiaryValue],
    );

    if (entityRows.length) {
      beneficiaryEntityId = toPositiveInt(entityRows[0].id);
    }
  }

  return {
    beneficiaryType,
    departmentId,
    beneficiaryEntityId,
  };
}

const VALID_REQUEST_TYPES = new Set(['Advance', 'Settlement', 'Expenditure']);
const DEFAULT_BULK_NEFT_TEMPLATE_VERSION = '2026-04-11';

const normalizeRequestType = (value) => {
  const type = normalizeText(value);
  if (!type) return null;
  const formatted = `${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()}`;
  return VALID_REQUEST_TYPES.has(formatted) ? formatted : null;
};

const normalizePaymentStatus = (value) => {
  const status = normalizeText(value);
  const allowed = new Set(['Paid', 'Pending', 'Processing', 'Cancelled']);
  return allowed.has(status) ? status : null;
};

const normalizeDebitStatus = (value) => {
  const status = normalizeText(value).toLowerCase();
  const allowed = new Set(['credited', 'reimbursement']);
  return allowed.has(status) ? status : null;
};

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
};

const inferRequestType = (payload) => {
  const explicitType = normalizeRequestType(payload.request_type || payload.activeTab);
  if (explicitType) return explicitType;

  if (Array.isArray(payload.advance_rows) && payload.advance_rows.some((row) => String(row?.advance || '').trim() !== '')) {
    return 'Advance';
  }
  if (Array.isArray(payload.settlement_rows) && payload.settlement_rows.some((row) => String(row?.settlement || '').trim() !== '')) {
    return 'Settlement';
  }
  if (Array.isArray(payload.expenditure_rows) && payload.expenditure_rows.some((row) => String(row?.expenditure || row?.autoSum || row?.auto_sum_amount || '').trim() !== '')) {
    return 'Expenditure';
  }
  return null;
};

let expenditureRequestColumnCache = null;

async function getExpenditureRequestColumns(source) {
  if (expenditureRequestColumnCache) return expenditureRequestColumnCache;

  const [rows] = await source.execute('SHOW COLUMNS FROM expenditure_requests');
  expenditureRequestColumnCache = new Set(rows.map((row) => String(row.Field || '').trim()));
  return expenditureRequestColumnCache;
}

async function getCumulativeAdvanceSummary(connOrDb, { userId, budgetLineId, head, subHead } = {}) {
  const uid = toPositiveInt(userId);
  const lineId = toPositiveInt(budgetLineId);
  const normalizedHead = normalizeText(head).toLowerCase();
  const normalizedSubHead = normalizeText(subHead).toLowerCase();

  if (!uid || (!lineId && (!normalizedHead || !normalizedSubHead))) {
    return { preAdvance: 0, count: 0 };
  }

  const source = connOrDb || db;
  const activeStatusClause = `
    LOWER(TRIM(er.overall_status)) NOT IN ('rejected', 'deleted')
  `;
  const requestColumns = await getExpenditureRequestColumns(source);
  const hasLegacyBudgetLine = requestColumns.has('budget_line_id');
  const hasLegacyHead = requestColumns.has('head');
  const hasLegacySubHead = requestColumns.has('sub_head');
  const legacyAmountExpr = requestColumns.has('amount')
    ? 'COALESCE(er.advance_total_amount, er.amount, er.total_amount, 0)'
    : 'COALESCE(er.advance_total_amount, er.total_amount, 0)';

  let rowMatchClause = 'ar.budget_line_id = ?';
  let legacyMatchClause = '1 = 0';
  let rowParams = [uid, lineId];
  let legacyParams = [uid];

  if (lineId && normalizedHead && normalizedSubHead) {
    rowMatchClause = `
      (
        ar.budget_line_id = ?
        OR (
          ar.budget_line_id IS NULL
          AND LOWER(TRIM(ar.budget_head)) = ?
          AND LOWER(TRIM(ar.sub_head)) = ?
        )
      )
    `;
    rowParams = [uid, lineId, normalizedHead, normalizedSubHead];
    if (hasLegacyBudgetLine) {
      legacyMatchClause = 'er.budget_line_id = ?';
      legacyParams = [uid, lineId];
    }
  } else if (!lineId) {
    rowMatchClause = `
      LOWER(TRIM(ar.budget_head)) = ?
      AND LOWER(TRIM(ar.sub_head)) = ?
    `;
    rowParams = [uid, normalizedHead, normalizedSubHead];
    if (hasLegacyHead && hasLegacySubHead) {
      legacyMatchClause = `
        LOWER(TRIM(er.head)) = ?
        AND LOWER(TRIM(er.sub_head)) = ?
      `;
      legacyParams = [uid, normalizedHead, normalizedSubHead];
    }
  } else if (hasLegacyBudgetLine) {
    legacyMatchClause = 'er.budget_line_id = ?';
    legacyParams = [uid, lineId];
  }

  const [[row]] = await source.execute(
    `SELECT
       COALESCE(row_totals.total_advanced, 0) + COALESCE(legacy_totals.total_advanced, 0) AS total_advanced,
       COALESCE(row_totals.cnt, 0) + COALESCE(legacy_totals.cnt, 0)                         AS cnt
     FROM (
       SELECT
         COALESCE(SUM(ar.advance_amount), 0) AS total_advanced,
         COUNT(DISTINCT er.id)               AS cnt
       FROM expenditure_advance_rows ar
       JOIN expenditure_requests er ON er.id = ar.expenditure_id
      WHERE er.created_by = ?
        AND er.request_type = 'Advance'
        AND ${activeStatusClause}
        AND ${rowMatchClause}
     ) AS row_totals
     CROSS JOIN (
       SELECT
         COALESCE(SUM(${legacyAmountExpr}), 0) AS total_advanced,
         COUNT(*)                              AS cnt
       FROM expenditure_requests er
      WHERE er.created_by = ?
        AND er.request_type = 'Advance'
        AND ${activeStatusClause}
        AND ${legacyMatchClause}
        AND NOT EXISTS (
          SELECT 1
            FROM expenditure_advance_rows arx
           WHERE arx.expenditure_id = er.id
        )
     ) AS legacy_totals`,
    [...rowParams, ...legacyParams],
  );

  return {
    preAdvance: toMoney(row?.total_advanced),
    count: Number(row?.cnt || 0),
  };
}

// ─── Transaction helper (same signature as budgetModel.withTransaction) ────────

export async function withTransaction(callback) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw new Error(`Transaction failed: ${err.message}`);
  } finally {
    conn.release();
  }
}

// ─── Reference-number generation (mirrors budget_proposal_refs pattern) ────────

async function insertExpenditureRef(conn, expenditureId, requestDate) {
  try {
    const year = requestDate
      ? new Date(requestDate).getFullYear()
      : new Date().getFullYear();

    const lockName = `expenditure_ref_fy_${year}`;
    const [[{ acquired }]] = await conn.execute(
      'SELECT GET_LOCK(?, 15) AS acquired', [lockName],
    );
    if (Number(acquired) !== 1) {
      throw new Error(`Could not acquire expenditure reference lock for ${year}`);
    }

    try {
      await conn.execute(
        `INSERT IGNORE INTO expenditure_request_refs
           (ref_year, ref_sequence, expenditure_request_id, request_ref)
         VALUES (?, 0, NULL, NULL)`,
        [year],
      );

      const [[{ cur }]] = await conn.execute(
        `SELECT COALESCE(MAX(ref_sequence), 0) AS cur
           FROM expenditure_request_refs
          WHERE ref_year = ?
            AND (expenditure_request_id IS NOT NULL OR ref_sequence > 0)`,
        [year],
      );

      const sequence = Number(cur) + 1;
      const ref = `#EX-${year}-${String(sequence).padStart(4, '0')}`;

      await conn.execute(
        `REPLACE INTO expenditure_request_refs
           (expenditure_request_id, ref_year, ref_sequence, request_ref)
         VALUES (?, ?, ?, ?)`,
        [expenditureId, year, sequence, ref],
      );

      return ref;
    } finally {
      await conn.execute('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return null;
    throw err;
  }
}

// ─── Approved-budget helpers ──────────────────────────────────────────────────

/**
 * Return all approved budget lines visible to the given user,
 * enriched with consumed amount and remaining balance.
 * "Approved" means the parent proposal status is 'completed'.
 */
async function getApprovedFinanceRequestOwner(connOrDb, financeRequestId) {
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId) return null;

  const source = connOrDb || db;
  const [rows] = await source.execute(
    `SELECT fr.id, fr.created_by
       FROM finance_requests fr
      WHERE fr.id = ?
        AND (
          LOWER(TRIM(COALESCE(fr.overall_status, ''))) = 'approved'
          OR LOWER(TRIM(COALESCE(fr.workflow_status, ''))) IN ('approved', 'completed')
          OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) IN ('approved', 'completed')
        )
      LIMIT 1`,
    [financeId],
  );

  return rows[0] || null;
}

export async function getApprovedBudgets({ userId, userEmail, financeRequestId } = {}) {
  const uid = toPositiveInt(userId);
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId || !uid) return [];

  const owner = await getApprovedFinanceRequestOwner(db, financeId);
  if (!owner) return [];
  if (toPositiveInt(owner.created_by) !== uid) return [];

  try {
    const [financeRows] = await db.execute(
      `SELECT
         fbb.budget_line_id,
         COALESCE(fbb.budget_proposal_id, bpl.budget_proposal_id)          AS budget_proposal_id,
         COALESCE(bp.proposal_ref, '')                                     AS proposal_ref,
         bp.fiscal_year,
         COALESCE(NULLIF(TRIM(fbb.budget_head), ''), bpl.budget_head, '')  AS head,
         COALESCE(NULLIF(TRIM(fbb.sub_head), ''), bpl.sub_head, '')        AS sub_head,
         COALESCE(
           bpl.approved_line_total,
           bpl.line_total,
           fbb.approved_amount,
           fbb.amount,
           0
         )                                                                 AS total_amount,
         COALESCE(fblu.consumed_amount, 0)                                 AS used_amount,
         GREATEST(
           0,
           COALESCE(
             fbb.remaining_amount_snapshot,
             fbb.available_amount_snapshot,
             COALESCE(
               bpl.approved_line_total,
               bpl.line_total,
               fbb.approved_amount,
               fbb.amount,
               0
             ) - COALESCE(fblu.consumed_amount, 0)
           )
         )                                                                 AS remaining_amount,
         fr.beneficiary_type,
         fr.beneficiary_value
       FROM finance_budget_breakup fbb
       JOIN finance_requests fr ON fr.id = fbb.finance_id
       LEFT JOIN budget_proposal_lines bpl ON bpl.id = fbb.budget_line_id
       LEFT JOIN budget_proposals bp
         ON bp.id = COALESCE(fbb.budget_proposal_id, bpl.budget_proposal_id)
       LEFT JOIN finance_budget_line_usage fblu ON fblu.budget_line_id = fbb.budget_line_id
       WHERE fbb.finance_id = ?
       ORDER BY fbb.sort_order ASC, fbb.id ASC`,
      [financeId],
    );

    return financeRows.map((r) => ({
      budgetLineId: toPositiveInt(r.budget_line_id),
      budgetProposalId: toPositiveInt(r.budget_proposal_id),
      proposalRef: normalizeText(r.proposal_ref),
      fiscalYear: Number(r.fiscal_year) || new Date().getFullYear(),
      head: normalizeText(r.head),
      subHead: normalizeText(r.sub_head),
      totalAmount: toMoney(r.total_amount),
      usedAmount: toMoney(r.used_amount),
      remainingAmount: toMoney(r.remaining_amount),
      beneficiaryType: normalizeText(r.beneficiary_type),
      beneficiaryValue: normalizeText(r.beneficiary_value),
    })).filter((row) => row.head && row.subHead);
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return [];
    throw error;
  }
}

// ─── Pre-advance summary ──────────────────────────────────────────────────────

/**
 * Total amount already advanced by this user on a given budget line.
 * First-time → preAdvance = 0.
 */
export async function getAdvanceSummary({ userId, budgetLineId, head, subHead } = {}) {
  return getCumulativeAdvanceSummary(db, { userId, budgetLineId, head, subHead });
}

// ─── Payee master ─────────────────────────────────────────────────────────────

export async function listPayees({ search = '', limit = 20, offset = 0 } = {}) {
  const q = normalizeText(search);
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offsetNum = Math.max(Number(offset) || 0, 0);
  const searchTerms = q
    .split(/\s+/)
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 8);

  const accountCompareSql = `
    REPLACE(REPLACE(REPLACE(LOWER(TRIM(COALESCE(account_no, ''))), ' ', ''), '-', ''), '\t', '')
  `;
  const rowAccountCompareSql = `
    REPLACE(REPLACE(REPLACE(LOWER(TRIM(COALESCE(epr.account_no, ''))), ' ', ''), '-', ''), '\t', '')
  `;
  const payeeSearchableColumns = `
    LOWER(CONCAT_WS(' ',
      COALESCE(ep.payee_name, ''),
      COALESCE(ep.account_name, ''),
      COALESCE(ep.account_no, ''),
      COALESCE(ep.bank_name, ''),
      COALESCE(ep.branch_name, ''),
      COALESCE(ep.ifsc, ''),
      COALESCE(ep.pan_number, ''),
      COALESCE(ep.beneficiary_type, ''),
      COALESCE(ep.beneficiary_org, ''),
      COALESCE(ep.organization_type, ''),
      COALESCE(ep.msme, ''),
      COALESCE(ep.gstin, ''),
      COALESCE(ep.tds_details, ''),
      COALESCE(ep.tds_section, '')
    ))
  `;
  const payeeRowSearchableColumns = `
    LOWER(CONCAT_WS(' ',
      COALESCE(epr.payee_name, ''),
      COALESCE(epr.account_name, ''),
      COALESCE(epr.account_no, ''),
      COALESCE(epr.bank_name, ''),
      COALESCE(epr.branch_name, ''),
      COALESCE(epr.ifsc, ''),
      COALESCE(epr.pan_number, ''),
      COALESCE(epr.beneficiary_type, ''),
      COALESCE(epr.beneficiary_org, ''),
      COALESCE(epr.organization_type, ''),
      COALESCE(epr.msme, ''),
      COALESCE(epr.gstin, ''),
      COALESCE(epr.tds_details, ''),
      COALESCE(epr.tds_section, '')
    ))
  `;

  if (searchTerms.length >= 2) {
    const ifscCandidate = searchTerms[searchTerms.length - 1].toUpperCase();
    const rawAccountCandidate = q
      .split(/\s+/)
      .slice(0, -1)
      .join(' ');
    const normalizedAccountCandidate = rawAccountCandidate
      .toLowerCase()
      .replace(/[\s-]+/g, '');

    if (normalizedAccountCandidate && ifscCandidate) {
      const [exactPayees] = await db.execute(
        `SELECT
           id,
           payee_name,
           account_name,
           pan_number,
           account_no,
           account_type,
           bank_name,
           branch_name,
           UPPER(TRIM(COALESCE(ifsc, ''))) AS ifsc,
           beneficiary_type,
           beneficiary_org,
           organization_type,
           msme,
           gstin,
           tds_details,
           tds_section,
           is_active,
           created_at,
           updated_at
         FROM expenditure_payees
         WHERE is_active = 1
           AND UPPER(TRIM(COALESCE(ifsc, ''))) = ?
           AND ${accountCompareSql} = ?
         ORDER BY updated_at DESC, id DESC
         LIMIT ${limitNum} OFFSET ${offsetNum}`,
        [ifscCandidate, normalizedAccountCandidate],
      );
      if (exactPayees.length) return exactPayees;

      const [exactPayeeRows] = await db.execute(
        `SELECT
           epr.id,
           epr.payee_id,
           epr.payee_name,
           epr.account_name,
           epr.pan_number,
           epr.account_no,
           epr.account_type,
           epr.bank_name,
           epr.branch_name,
           UPPER(TRIM(COALESCE(epr.ifsc, ''))) AS ifsc,
           epr.beneficiary_type,
           epr.beneficiary_org,
           epr.organization_type,
           epr.msme,
           epr.gstin,
           epr.tds_details,
           epr.tds_section,
           1 AS is_active,
           epr.created_at,
           epr.updated_at
         FROM expenditure_payee_rows epr
         INNER JOIN (
           SELECT MAX(id) AS id
             FROM expenditure_payee_rows
            WHERE NULLIF(TRIM(account_no), '') IS NOT NULL
              AND NULLIF(TRIM(ifsc), '') IS NOT NULL
            GROUP BY
              REPLACE(REPLACE(REPLACE(LOWER(TRIM(account_no)), ' ', ''), '-', ''), '\t', ''),
              UPPER(TRIM(ifsc))
         ) latest ON latest.id = epr.id
         WHERE UPPER(TRIM(COALESCE(epr.ifsc, ''))) = ?
           AND ${rowAccountCompareSql} = ?
         ORDER BY epr.updated_at DESC, epr.id DESC
         LIMIT ${limitNum} OFFSET ${offsetNum}`,
        [ifscCandidate, normalizedAccountCandidate],
      );
      if (exactPayeeRows.length) return exactPayeeRows;
    }
  }

  const termClauses = searchTerms.length
    ? searchTerms.map(() => `${payeeRowSearchableColumns} LIKE ?`).join(' AND ')
    : '1 = 1';

  const [payeeRowResults] = await db.execute(
    `SELECT
       epr.id,
       epr.payee_id,
       epr.payee_name,
       epr.account_name,
       epr.pan_number,
       epr.account_no,
       epr.account_type,
       epr.bank_name,
       epr.branch_name,
       UPPER(TRIM(COALESCE(epr.ifsc, ''))) AS ifsc,
       epr.beneficiary_type,
       epr.beneficiary_org,
       epr.organization_type,
       epr.msme,
       epr.gstin,
       epr.tds_details,
       epr.tds_section,
       1 AS is_active,
       epr.created_at,
       epr.updated_at
     FROM expenditure_payee_rows epr
     INNER JOIN (
       SELECT MAX(id) AS id
         FROM expenditure_payee_rows
        WHERE COALESCE(NULLIF(TRIM(payee_name), ''), NULLIF(TRIM(account_no), ''), NULLIF(TRIM(ifsc), '')) IS NOT NULL
        GROUP BY
          CASE
            WHEN NULLIF(TRIM(account_no), '') IS NOT NULL THEN LOWER(TRIM(account_no))
            ELSE CONCAT('__payee_row__', id)
          END,
          CASE
            WHEN NULLIF(TRIM(ifsc), '') IS NOT NULL THEN UPPER(TRIM(ifsc))
            ELSE CONCAT('__payee_row__', id)
          END
     ) latest ON latest.id = epr.id
     WHERE ${termClauses}
     ORDER BY epr.updated_at DESC, epr.id DESC
     LIMIT ${limitNum} OFFSET ${offsetNum}`,
    [...searchTerms.map((term) => `%${term}%`)],
  );

  if (payeeRowResults.length) return payeeRowResults;

  const payeeTermClauses = searchTerms.length
    ? searchTerms.map(() => `${payeeSearchableColumns} LIKE ?`).join(' AND ')
    : '1 = 1';

  const [rows] = await db.execute(
    `SELECT * FROM expenditure_payees ep
      WHERE ep.is_active = 1
        AND ${payeeTermClauses}
      ORDER BY ep.payee_name ASC LIMIT ${limitNum} OFFSET ${offsetNum}`,
    [...searchTerms.map((term) => `%${term}%`)],
  );
  return rows;
}

export async function getPayeeById(id) {
  const [rows] = await db.execute(
    'SELECT * FROM expenditure_payees WHERE id = ? LIMIT 1', [id],
  );
  return rows[0] || null;
}

export async function getExpenditureDashboard({ userId, fiscalYear } = {}) {
  const uid = toPositiveInt(userId);
  if (!uid) {
    return { cards: [], requests: [] };
  }

  const fyStart = toPositiveInt(fiscalYear);
  const financeParams = [uid];
  const expenditureParams = [uid];
  let financeFySql = '';
  let expenditureFySql = '';

  if (fyStart) {
    const fyFrom = `${fyStart}-04-01`;
    const fyTo = `${fyStart + 1}-04-01`;
    financeFySql = ' AND fr.request_date >= ? AND fr.request_date < ?';
    expenditureFySql = ' AND er.request_date >= ? AND er.request_date < ?';
    financeParams.push(fyFrom, fyTo);
    expenditureParams.push(fyFrom, fyTo);
  }

  const [cardRows] = await db.execute(
    `SELECT
       fr.id AS finance_request_id,
       COALESCE(frr.request_ref, CONCAT('#F-', fr.id)) AS request_ref,
       COALESCE(
         NULLIF(TRIM(CONCAT(COALESCE(emp.title, ''), ' ', COALESCE(emp.first_name, ''), ' ', COALESCE(emp.last_name, ''))), ''),
         NULLIF(TRIM(fr.applicant_name), ''),
         'Unknown Applicant'
       ) AS applicant_name,
       COALESCE(NULLIF(TRIM(emp.designation), ''), NULLIF(TRIM(fr.designation), ''), '') AS designation,
       COALESCE(NULLIF(TRIM(dept.name), ''), NULLIF(TRIM(fr.department), ''), '') AS department,
       COALESCE(NULLIF(TRIM(fr.beneficiary_value), ''), NULLIF(TRIM(fr.beneficiary_type), ''), 'Finance') AS finance_tag,
       COALESCE(fr.approved_total_amount, fr.total_budget, 0) AS approved_amount,
       COALESCE(SUM(
         CASE
           WHEN er.request_type = 'Advance'
             AND LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
           THEN COALESCE(er.advance_total_amount, er.total_amount, 0)
           ELSE 0
         END
       ), 0) AS advance_amount,
       COALESCE(SUM(
         CASE
           WHEN er.request_type = 'Expenditure'
             AND LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
           THEN COALESCE(er.expenditure_total_amount, er.total_amount, 0)
           ELSE 0
         END
       ), 0) AS expenditure_amount,
       COALESCE(SUM(
         CASE
           WHEN er.request_type = 'Settlement'
             AND LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
           THEN COALESCE(er.settlement_total_amount, er.total_amount, 0)
           ELSE 0
         END
       ), 0) AS settlement_amount,
       COUNT(DISTINCT er.id) AS expenditure_request_count
     FROM finance_requests fr
     LEFT JOIN finance_request_refs frr ON frr.finance_request_id = fr.id
     LEFT JOIN master_employees emp ON emp.id = fr.employee_id
     LEFT JOIN master_departments dept ON dept.id = emp.department_id
     LEFT JOIN expenditure_requests er ON er.finance_request_id = fr.id
     WHERE fr.created_by = ?
       AND (
         LOWER(TRIM(COALESCE(fr.overall_status, ''))) = 'approved'
         OR LOWER(TRIM(COALESCE(fr.workflow_status, ''))) IN ('approved', 'completed')
         OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) IN ('approved', 'completed')
       )
       ${financeFySql}
     GROUP BY
       fr.id,
       frr.request_ref,
       applicant_name,
       designation,
       department,
       approved_amount
     ORDER BY fr.request_date DESC, fr.id DESC`,
    financeParams,
  );

  const [requestRows] = await db.execute(
	    `SELECT
	       er.id,
	       er.finance_request_id AS finance_id,
	       COALESCE(frr.request_ref, CONCAT('#F-', er.finance_request_id)) AS proposal_ref,
	       COALESCE(
	         NULLIF(TRIM(CONCAT(COALESCE(emp.title, ''), ' ', COALESCE(emp.first_name, ''), ' ', COALESCE(emp.last_name, ''))), ''),
	         NULLIF(TRIM(er.applicant_name), ''),
	         'Unknown Applicant'
	       ) AS applicant_name,
       COALESCE(NULLIF(TRIM(er.beneficiary_type), ''), 'Unknown') AS beneficiary_type,
       COALESCE(NULLIF(TRIM(er.primary_head), ''), 'Not specified') AS primary_head,
       COALESCE(er.total_amount, 0) AS amount,
       LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) AS overall_status,
	       er.created_at
	     FROM expenditure_requests er
	     LEFT JOIN master_employees emp ON emp.id = er.employee_id
       LEFT JOIN finance_request_refs frr ON frr.finance_request_id = er.finance_request_id
	     WHERE er.created_by = ?
       AND LOWER(TRIM(COALESCE(er.overall_status, 'pending'))) <> 'deleted'
       ${expenditureFySql}
     ORDER BY er.created_at DESC, er.id DESC`,
    expenditureParams,
  );

  return {
    cards: cardRows.map((row) => {
      const approvedAmount = toMoney(row.approved_amount);
      const advanceAmount = toMoney(row.advance_amount);
      const expenditureAmount = toMoney(row.expenditure_amount);
      const settlementAmount = toMoney(row.settlement_amount);

      return {
        finance_request_id: toPositiveInt(row.finance_request_id),
        request_ref: normalizeText(row.request_ref),
        applicant_name: normalizeText(row.applicant_name),
        designation: normalizeText(row.designation),
        department: normalizeText(row.department),
        finance_tag: normalizeText(row.finance_tag) || 'Finance',
        approved_amount: approvedAmount,
        advance_amount: advanceAmount,
        expenditure_amount: expenditureAmount,
        settlement_amount: settlementAmount,
        balance_amount: Math.max(0, approvedAmount - Math.max(advanceAmount, expenditureAmount)),
        expenditure_request_count: Number(row.expenditure_request_count || 0),
      };
    }),
    requests: requestRows.map((row) => ({
      id: toPositiveInt(row.id),
      finance_id: toPositiveInt(row.finance_id),
      proposal_ref: normalizeText(row.proposal_ref),
      applicant_name: normalizeText(row.applicant_name),
      beneficiary_type: normalizeText(row.beneficiary_type),
      primary_head: normalizeText(row.primary_head),
      amount: toMoney(row.amount),
      overall_status: normalizeText(row.overall_status) || 'pending',
      created_at: row.created_at,
    })),
  };
}

export async function getFinanceRequestContext(financeRequestId) {
  const financeId = toPositiveInt(financeRequestId);
  if (!financeId) return null;

  const [rows] = await db.execute(
    `SELECT
       fr.id AS finance_request_id,
       fr.created_by,
       fr.employee_id,
       COALESCE(frr.request_ref, CONCAT('#F-', fr.id)) AS request_ref,
       COALESCE(
         NULLIF(TRIM(CONCAT(COALESCE(emp.title, ''), ' ', COALESCE(emp.first_name, ''), ' ', COALESCE(emp.last_name, ''))), ''),
         NULLIF(TRIM(fr.applicant_name), ''),
         'Unknown Applicant'
       ) AS applicant_name,
       COALESCE(NULLIF(TRIM(emp.designation), ''), NULLIF(TRIM(fr.designation), ''), '') AS designation,
       COALESCE(NULLIF(TRIM(dept.name), ''), NULLIF(TRIM(fr.department), ''), '') AS department,
       COALESCE(NULLIF(TRIM(emp.email), ''), NULLIF(TRIM(fr.email), ''), '') AS email,
       COALESCE(NULLIF(TRIM(emp.mobile), ''), NULLIF(TRIM(fr.mobile), ''), '') AS mobile,
       fr.request_date,
       fr.description,
       fr.beneficiary_type,
       fr.beneficiary_value,
       fr.primary_head,
       fr.event_sub_head,
       COALESCE(fr.approved_total_amount, fr.total_budget, 0) AS approved_amount
     FROM finance_requests fr
     LEFT JOIN finance_request_refs frr ON frr.finance_request_id = fr.id
     LEFT JOIN master_employees emp ON emp.id = fr.employee_id
     LEFT JOIN master_departments dept ON dept.id = emp.department_id
	     WHERE fr.id = ?
        AND (
          LOWER(TRIM(COALESCE(fr.overall_status, ''))) = 'approved'
          OR LOWER(TRIM(COALESCE(fr.workflow_status, ''))) IN ('approved', 'completed')
          OR LOWER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(fr.workflow_state, '$.status')), ''))) IN ('approved', 'completed')
        )
	     LIMIT 1`,
    [financeId],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    finance_request_id: toPositiveInt(row.finance_request_id),
    created_by: toPositiveInt(row.created_by),
    employee_id: toPositiveInt(row.employee_id),
    request_ref: normalizeText(row.request_ref),
    applicant_name: normalizeText(row.applicant_name),
    designation: normalizeText(row.designation),
    department: normalizeText(row.department),
    email: normalizeText(row.email),
    mobile: normalizeText(row.mobile),
    request_date: row.request_date,
    description: normalizeText(row.description),
    beneficiary_type: normalizeText(row.beneficiary_type),
    beneficiary_value: normalizeText(row.beneficiary_value),
    primary_head: normalizeText(row.primary_head),
    event_sub_head: normalizeText(row.event_sub_head),
    approved_amount: toMoney(row.approved_amount),
  };
}

/**
 * Upsert a payee. Unique key: (account_no, ifsc).
 * Returns the payee id (existing or new).
 */
export async function upsertPayee(payeeData, userId, conn = db) {
  const accountNo = normalizeText(payeeData.account_no);
  const ifsc      = normalizeText(payeeData.ifsc).toUpperCase();
  const beneficiaryType = normalizeText(payeeData.beneficiary_type).toLowerCase() === 'organization'
    ? 'organization'
    : 'individual';
  const beneficiaryOrgRaw = normalizeText(payeeData.beneficiary_org);
  const beneficiaryOrg = ['KSRCT', 'KSREI', 'External'].includes(beneficiaryOrgRaw)
    ? beneficiaryOrgRaw
    : null;
  if (!accountNo || !ifsc) throw new Error('account_no and ifsc are required');

  const [existing] = await conn.execute(
    'SELECT id FROM expenditure_payees WHERE account_no = ? AND ifsc = ? LIMIT 1',
    [accountNo, ifsc],
  );

  if (existing.length) {
    await conn.execute(
      `UPDATE expenditure_payees
          SET payee_name   = COALESCE(?, payee_name),
              account_name = COALESCE(?, account_name),
              pan_number   = COALESCE(?, pan_number),
              account_type = COALESCE(?, account_type),
              bank_name    = COALESCE(?, bank_name),
              branch_name  = COALESCE(?, branch_name),
              beneficiary_type = COALESCE(?, beneficiary_type),
              beneficiary_org  = COALESCE(?, beneficiary_org),
              organization_type = COALESCE(?, organization_type),
              msme         = COALESCE(?, msme),
              gstin        = COALESCE(?, gstin),
              tds_details  = COALESCE(?, tds_details),
              tds_section  = COALESCE(?, tds_section),
              is_active    = 1,
              updated_at   = CURRENT_TIMESTAMP
        WHERE id = ?`,
      [
        payeeData.payee_name   || null,
        payeeData.account_name || null,
        payeeData.pan_number   || null,
        payeeData.account_type || null,
        payeeData.bank_name    || null,
        payeeData.branch_name  || null,
        beneficiaryType,
        beneficiaryOrg,
        payeeData.organization_type || null,
        payeeData.msme         || null,
        payeeData.gstin        || null,
        payeeData.tds_details  || null,
        payeeData.tds_section  || null,
        existing[0].id,
      ],
    );
    return toPositiveInt(existing[0].id);
  }

  const [result] = await conn.execute(
    `INSERT INTO expenditure_payees
       (payee_name, account_name, account_no, account_type,
        bank_name, branch_name, ifsc, beneficiary_type,
        beneficiary_org, organization_type, msme,
        pan_number, gstin, tds_details, tds_section, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalizeText(payeeData.payee_name),
      payeeData.account_name  || null,
      accountNo,
      payeeData.account_type  || null,
      normalizeText(payeeData.bank_name),
      normalizeText(payeeData.branch_name || ''),
      ifsc,
      beneficiaryType,
      beneficiaryOrg,
      payeeData.organization_type || null,
      payeeData.msme         || null,
      payeeData.pan_number  || null,
      payeeData.gstin       || null,
      payeeData.tds_details || null,
      payeeData.tds_section || null,
      userId || null,
    ],
  );
  return result.insertId;
}

// ─── Core SELECT for expenditure_requests ────────────────────────────────────

const EXPENDITURE_SELECT = `
  SELECT
    er.id,
    COALESCE(err.request_ref, CONCAT('#EX-', er.id)) AS request_ref,
    er.finance_request_id,
    er.employee_id,
    er.created_by,
    er.request_type,
    er.request_date,
    er.description,
    er.primary_head,
    er.event_sub_head,
    er.advance_total_amount,
    er.settlement_total_amount,
    er.expenditure_total_amount,
    er.total_amount,
    er.payment_debit_account,
    er.payment_mode,
    er.payment_ref_no,
    er.payment_date,
    er.payment_status,
    er.overall_status,
    er.created_at,
    er.updated_at,
    sample_row.budget_line_id,
    sample_row.budget_proposal_id,
    sample_row.budget_head AS head,
    sample_row.sub_head,
    sample_payee.payee_id,
    sample_payee.payee_name,
    sample_payee.account_no,
    sample_payee.ifsc,
    sample_payee.bank_name,
    sample_payee.branch_name,
    sample_payee.account_name,
    sample_payee.account_type,
    COALESCE(
      NULLIF(TRIM(CONCAT(
        COALESCE(e.title,''),' ',
        COALESCE(e.first_name,''),' ',
        COALESCE(e.last_name,'')
      )), ''),
      NULLIF(TRIM(er.applicant_name), ''),
      ''
    ) AS applicant_name,
    COALESCE(NULLIF(TRIM(e.designation), ''), NULLIF(TRIM(er.designation), ''), '') AS designation,
    COALESCE(NULLIF(TRIM(d.name), ''), NULLIF(TRIM(er.department), ''), '') AS department,
    COALESCE(NULLIF(TRIM(e.email), ''), NULLIF(TRIM(er.email), ''), '') AS email,
    COALESCE(NULLIF(TRIM(e.mobile), ''), NULLIF(TRIM(er.mobile), ''), '') AS mobile,
    e.erp_id
  FROM expenditure_requests er
  LEFT JOIN expenditure_request_refs err ON err.expenditure_request_id = er.id
  LEFT JOIN master_employees e ON e.id = er.employee_id
  LEFT JOIN master_departments d ON d.id = e.department_id
  LEFT JOIN (
    SELECT
      ranked.expenditure_id,
      ranked.budget_line_id,
      ranked.budget_proposal_id,
      ranked.budget_head,
      ranked.sub_head
    FROM (
      SELECT
        all_rows.expenditure_id,
        all_rows.budget_line_id,
        all_rows.budget_proposal_id,
        all_rows.budget_head,
        all_rows.sub_head,
        ROW_NUMBER() OVER (
          PARTITION BY all_rows.expenditure_id
          ORDER BY all_rows.sort_order ASC, all_rows.id ASC
        ) AS rn
      FROM (
        SELECT
          ar.expenditure_id,
          ar.budget_line_id,
          ar.budget_proposal_id,
          ar.budget_head,
          ar.sub_head,
          ar.sort_order,
          ar.id
        FROM expenditure_advance_rows ar
        UNION ALL
        SELECT
          sr.expenditure_id,
          sr.budget_line_id,
          sr.budget_proposal_id,
          sr.budget_head,
          sr.sub_head,
          sr.sort_order,
          sr.id
        FROM expenditure_settlement_rows sr
        UNION ALL
        SELECT
          lr.expenditure_id,
          lr.budget_line_id,
          lr.budget_proposal_id,
          lr.budget_head,
          lr.sub_head,
          lr.sort_order,
          lr.id
        FROM expenditure_line_rows lr
      ) all_rows
    ) ranked
    WHERE ranked.rn = 1
  ) sample_row ON sample_row.expenditure_id = er.id
  LEFT JOIN (
    SELECT
      ranked_payee.expenditure_id,
      ranked_payee.payee_id,
      ranked_payee.payee_name,
      ranked_payee.account_no,
      ranked_payee.ifsc,
      ranked_payee.bank_name,
      ranked_payee.branch_name,
      ranked_payee.account_name,
      ranked_payee.account_type
    FROM (
      SELECT
        p.expenditure_id,
        p.payee_id,
        p.payee_name,
        p.account_no,
        p.ifsc,
        p.bank_name,
        p.branch_name,
        p.account_name,
        p.account_type,
        ROW_NUMBER() OVER (
          PARTITION BY p.expenditure_id
          ORDER BY p.sort_order ASC, p.id ASC
        ) AS rn
      FROM expenditure_payee_rows p
    ) ranked_payee
    WHERE ranked_payee.rn = 1
  ) sample_payee ON sample_payee.expenditure_id = er.id
`;

// ─── Expenditure CRUD ─────────────────────────────────────────────────────────

/**
 * Create a new expenditure (advance) request.
 *
 * Steps inside the transaction:
 *   1. Validate budget line is approved with sufficient remaining balance.
 *   2. Upsert payee if inline payment_details provided instead of payee_id.
 *   3. Calculate pre-advance (sum of prior approved advances on same budget line).
 *   4. Insert expenditure_requests row.
 *   5. Allocate a sequential reference number.
 *   6. Deduct amount from finance_budget_line_usage (consumed_amount).
 *   7. Write to audit ledger.
 */
async function createExpenditureLegacy(data, userId) {
  return withTransaction(async (conn) => {

    // ── 1. Budget validation ────────────────────────────────────────────────
    const budgetLineId = toPositiveInt(data.budget_line_id);
    if (!budgetLineId) throw new Error('budget_line_id is required');

    const [[lineRow]] = await conn.execute(
      `SELECT
         bpl.id,
         bpl.budget_proposal_id,
         bpl.budget_head  AS head,
         bpl.sub_head,
         COALESCE(bpl.approved_line_total, bpl.line_total, 0)  AS total_amount,
         COALESCE(fblu.consumed_amount, 0)                      AS used_amount,
         GREATEST(
           0,
           COALESCE(bpl.approved_line_total, bpl.line_total, 0)
           - COALESCE(fblu.consumed_amount, 0)
         )                                                       AS remaining_amount,
         bp.status
       FROM budget_proposal_lines bpl
       JOIN budget_proposals bp ON bp.id = bpl.budget_proposal_id
       LEFT JOIN finance_budget_line_usage fblu ON fblu.budget_line_id = bpl.id
       WHERE bpl.id = ?
         AND (
           LOWER(TRIM(bp.status)) IN ('completed','approved','principal_approved')
           OR LOWER(TRIM(bp.current_stage)) = 'completed'
         )
       LIMIT 1 FOR UPDATE`,
      [budgetLineId],
    );

    if (!lineRow) throw new Error('Budget line not found or not yet approved');

    const requestedAmount = toMoney(data.amount);
    if (requestedAmount <= 0) throw new Error('amount must be greater than 0');

    const remaining = toMoney(lineRow.remaining_amount);
    if (requestedAmount > remaining) {
      throw new Error(
        `Requested ₹${requestedAmount.toFixed(2)} exceeds remaining budget ₹${remaining.toFixed(2)}`,
      );
    }

    // ── 2. Resolve payee ────────────────────────────────────────────────────
    let payeeId = toPositiveInt(data.payee_id);
    if (!payeeId && data.payment_details) {
      payeeId = await upsertPayee(
        {
          payee_name:   data.payment_details.payee_name   || data.purpose || 'Unknown',
          account_no:   data.payment_details.account_no,
          ifsc:         data.payment_details.ifsc,
          bank_name:    data.payment_details.bank_name,
          branch_name:  data.payment_details.branch_name  || '',
          account_name: data.payment_details.account_name || null,
          account_type: data.payment_details.account_type || null,
          pan_number:   data.payment_details.pan_number   || null,
        },
        userId,
        conn,
      );
    }

    // ── 3. Pre-advance (first time = 0, subsequent = prior total) ──────────
    const { preAdvance } = await getCumulativeAdvanceSummary(conn, {
      userId,
      budgetLineId,
      head: lineRow.head,
      subHead: lineRow.sub_head,
    });

    // ── 4. Resolve department from employee ─────────────────────────────────
    const employeeId = toPositiveInt(data.employee_id);
    const workflowContext = await resolveExpenditureWorkflowContext(conn, {
      employee_id: data.employee_id,
      beneficiary_type: data.beneficiary_type,
      beneficiary_value: data.beneficiary_value,
      department_id: data.department_id,
      beneficiary_entity_id: data.beneficiary_entity_id,
    });

    // ── 5. Insert expenditure row ───────────────────────────────────────────
    const entry = {
      finance_request_id:   toPositiveInt(data.finance_request_id),
      budget_line_id:       budgetLineId,
      budget_proposal_id:   toPositiveInt(lineRow.budget_proposal_id),
      employee_id:          employeeId || null,
      payee_id:             payeeId || null,
      created_by:           toPositiveInt(userId),
      request_date:         data.request_date || new Date().toISOString().slice(0, 10),
      request_type:         'Advance',
      description:          normalizeText(data.description) || null,
      purpose:              normalizeText(data.purpose) || null,
      beneficiary_type:     normalizeBeneficiaryType(data.beneficiary_type)
                              || normalizeText(data.beneficiary_type)
                              || 'Individual Faculty',
      beneficiary_value:    normalizeText(data.beneficiary_value) || null,
      budget_tag:           normalizeText(data.budget_tag) || null,
      department_id:        workflowContext.departmentId,
      beneficiary_entity_id: workflowContext.beneficiaryEntityId,
      primary_head:         normalizeText(data.primary_head)
                              || normalizeText(lineRow.head)
                              || 'General',
      event_sub_head:       normalizeText(data.event_sub_head) || null,
      head:                 normalizeText(lineRow.head),
      sub_head:             normalizeText(lineRow.sub_head),
      amount:               requestedAmount,
      pre_advance_amount:   preAdvance,
      advance_total_amount: requestedAmount,
      total_amount:         requestedAmount,
      approved_total_amount: 0,
      payment_debit_account: normalizeText(data.payment_debit_account) || null,
      payment_mode:          normalizeText(data.payment_mode) || null,
      payment_status:       'Pending',
      overall_status:       'pending',
    };

    const filteredEntry = Object.fromEntries(
      Object.entries(entry).filter(([, value]) => value !== null && value !== undefined),
    );
    const entryKeys = Object.keys(filteredEntry);
    const entryValues = Object.values(filteredEntry);

    const [result] = await conn.execute(
      `INSERT INTO expenditure_requests (${entryKeys.map((key) => `\`${key}\``).join(', ')})
       VALUES (${entryKeys.map(() => '?').join(', ')})`,
      entryValues,
    );
    const expenditureId = result.insertId;

    // ── 6. Sequential reference number ─────────────────────────────────────
    const ref = await insertExpenditureRef(conn, expenditureId, data.request_date);

    // ── 7. Consume budget balance ───────────────────────────────────────────
    await conn.execute(
      `INSERT INTO finance_budget_line_usage (budget_line_id, consumed_amount)
       VALUES (?, 0.00)
       ON DUPLICATE KEY UPDATE budget_line_id = budget_line_id`,
      [budgetLineId],
    );
    await conn.execute(
      `UPDATE finance_budget_line_usage
          SET consumed_amount = consumed_amount + ?,
              updated_at      = CURRENT_TIMESTAMP
        WHERE budget_line_id  = ?`,
      [requestedAmount, budgetLineId],
    );

    // ── 8. Audit ledger ────────────────────────────────────────────────────
    try {
      await conn.execute(
        `INSERT INTO expenditure_budget_ledger
           (expenditure_id, budget_line_id, operation, amount,
            balance_after, actor_user_id, remarks)
         VALUES (?, ?, 'advance', ?, ?, ?, 'Advance requested')`,
        [
          expenditureId,
          budgetLineId,
          requestedAmount,
          toMoney(lineRow.used_amount) + requestedAmount,
          toPositiveInt(userId),
        ],
      );
    } catch (auditErr) {
      if (auditErr?.code !== 'ER_NO_SUCH_TABLE') throw auditErr;
    }

    return { expenditureId, requestRef: ref };
  });
}

export async function createExpenditure(data, userId) {
  const financeRequestId = toPositiveInt(data.finance_request_id);
  if (!financeRequestId) {
    throw new Error('finance_request_id is required');
  }

  const budgetLineId = toPositiveInt(data.budget_line_id);
  if (!budgetLineId) {
    throw new Error('budget_line_id is required');
  }

  const amount = toMoney(data.amount);
  if (amount <= 0) {
    throw new Error('amount must be greater than 0');
  }

  const paymentDetails = data.payment_details || {};
  const payload = {
    finance_request_id: financeRequestId,
    employee_id: toPositiveInt(data.employee_id),
    request_date: data.request_date || new Date().toISOString().slice(0, 10),
    description: normalizeText(data.description) || normalizeText(data.purpose) || null,
    beneficiary_type: normalizeBeneficiaryType(data.beneficiary_type)
      || normalizeText(data.beneficiary_type)
      || 'Individual Faculty',
    beneficiary_value: normalizeText(data.beneficiary_value) || null,
    budget_tag: normalizeText(data.budget_tag) || null,
    primary_head: normalizeText(data.primary_head) || 'General',
    event_sub_head: normalizeText(data.event_sub_head) || null,
    request_type: 'Advance',
    advance_rows: [
      {
        budget_line_id: budgetLineId,
        budgetLineId,
        budget_proposal_id: toPositiveInt(data.budget_proposal_id),
        budgetProposalId: toPositiveInt(data.budget_proposal_id),
        budget_head: normalizeText(data.head) || null,
        budgetHead: normalizeText(data.head) || null,
        sub_head: normalizeText(data.sub_head) || null,
        subHead: normalizeText(data.sub_head) || null,
        advance_amount: amount,
        advance: amount,
      },
    ],
    payee_rows: data.payee_id || paymentDetails.account_no
      ? [
        {
          payee_id: toPositiveInt(data.payee_id),
          payee_name: normalizeText(paymentDetails.payee_name || data.payee_name) || null,
          bank_name: normalizeText(paymentDetails.bank_name) || null,
          account_no: normalizeText(paymentDetails.account_no) || null,
          ifsc: normalizeText(paymentDetails.ifsc).toUpperCase() || null,
          branch_name: normalizeText(paymentDetails.branch_name) || null,
          amount,
          mode: normalizeText(paymentDetails.mode || data.payment_mode) || null,
        },
      ]
      : [],
    payment_details: paymentDetails,
    payment_mode: normalizeText(paymentDetails.mode || data.payment_mode) || null,
    payment_ref_no: normalizeText(paymentDetails.refNo || data.payment_ref_no) || null,
    payment_date: paymentDetails.date || data.payment_date || null,
    payment_status: normalizePaymentStatus(paymentDetails.status || data.payment_status || 'Pending'),
    payment_debit_account: normalizeText(paymentDetails.debitAccount || data.payment_debit_account) || null,
  };

  return createExpenditureRequest(payload, userId, { billFiles: [], bulkNeftFile: null });
}

function sanitizeRowValue(value) {
  return normalizeText(value) || null;
}

function moneyOrNull(value) {
  const amount = toMoney(value);
  return amount !== 0 ? amount : null;
}

function toStoredUploadPath(filePath = '') {
  const relativePath = filePath
    ? `/${filePath.replace(process.cwd(), '').replace(/^[\\/]+/, '').replace(/\\/g, '/')}`
    : null;
  return relativePath;
}

function withUploadAccess(row) {
  if (!row) return null;

  const filePath = normalizeText(row.file_path) || null;
  return {
    ...row,
    file_url: filePath,
    download_url: filePath,
  };
}

async function insertIncomeRows(conn, expenditureId, rows = []) {
  const validRows = Array.isArray(rows) ? rows : [];
  let sortOrder = 0;
  for (const row of validRows) {
    const incomeSource = sanitizeRowValue(row.incomeSource || row.income_source);
    const contribution = sanitizeRowValue(row.contribution);
    const amount = toMoney(row.amount);
    const status = sanitizeRowValue(row.status);
    const creditAccount = sanitizeRowValue(row.creditAccount || row.credit_account);
    if (!incomeSource && !contribution && amount === 0 && !status && !creditAccount) continue;

    await conn.execute(
      `INSERT INTO expenditure_income_rows
         (expenditure_id, income_source, contribution, amount, status, remarks, credit_account, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [expenditureId, incomeSource, contribution, amount, status, null, creditAccount, sortOrder],
    );
    sortOrder += 1;
  }
}

async function insertPayeeRows(conn, expenditureId, rows = [], userId = null) {
  const validRows = Array.isArray(rows) ? rows : [];
  let sortOrder = 0;
  for (const row of validRows) {
    const existingPayeeId = toPositiveInt(row.payeeId || row.payee_id);
    const payeeName = sanitizeRowValue(row.payeeName || row.payee_name);
    const bankName = sanitizeRowValue(row.bankName || row.bank_name);
    const accountNo = sanitizeRowValue(row.accountNo || row.account_no);
    const ifsc = sanitizeRowValue(row.ifsc);
    const branchName = sanitizeRowValue(row.branchName || row.branch_name);
    const url = sanitizeRowValue(row.url);
    const amount = toMoney(row.amount);
    const mode = sanitizeRowValue(row.mode);
    const accountName = sanitizeRowValue(row.accountName || row.account_name);
    const panNumber = sanitizeRowValue(row.panNumber || row.pan_number);
    const accountType = sanitizeRowValue(row.accountType || row.account_type);
    const beneficiaryType = sanitizeRowValue(row.beneficiaryType || row.beneficiary_type) || 'individual';
    const beneficiaryOrg = sanitizeRowValue(row.beneficiaryOrg || row.beneficiary_org);
    const organizationType = sanitizeRowValue(row.organizationType || row.organization_type);
    const msme = sanitizeRowValue(row.msme);
    const gstin = sanitizeRowValue(row.gstin);
    const tdsDetails = sanitizeRowValue(row.tdsDetails || row.tds_details);
    const tdsSection = sanitizeRowValue(row.tdsSection || row.tds_section);
    if (!payeeName && !accountNo && !bankName && amount === 0 && !mode) continue;

    let payeeId = existingPayeeId || null;
    if (!payeeId && accountNo && ifsc) {
      payeeId = await upsertPayee(
        {
          payee_name: payeeName,
          bank_name: bankName,
          account_no: accountNo,
          ifsc,
          branch_name: branchName,
          account_name: accountName,
          pan_number: panNumber,
          account_type: accountType,
          beneficiary_type: beneficiaryType,
          beneficiary_org: beneficiaryOrg,
          organization_type: organizationType,
          msme,
          gstin,
          tds_details: tdsDetails,
          tds_section: tdsSection,
        },
        userId,
        conn,
      );
    }

    await conn.execute(
      `INSERT INTO expenditure_payee_rows
         (expenditure_id, payee_id, payee_name, bank_name, account_no, ifsc, branch_name, url,
          amount, mode, account_name, pan_number, account_type,
          beneficiary_type, beneficiary_org, organization_type, msme, gstin, tds_details, tds_section, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [expenditureId, payeeId, payeeName, bankName, accountNo, ifsc, branchName, url, amount, mode,
       accountName, panNumber, accountType, beneficiaryType, beneficiaryOrg,
       organizationType, msme, gstin, tdsDetails, tdsSection, sortOrder],
    );
    sortOrder += 1;
  }
}

async function insertAdvanceRows(conn, expenditureId, rows = [], userId = null) {
  const validRows = Array.isArray(rows) ? rows : [];
  let sortOrder = 0;
  for (const row of validRows) {
    const budgetHead = sanitizeRowValue(row.budgetHead || row.budget_head);
    const subHead = sanitizeRowValue(row.subHead || row.sub_head);
    const budgetAmount = moneyOrNull(row.budget);
    const budgetProposalId = toPositiveInt(row.budgetProposalId || row.budget_proposal_id);
    const budgetLineId = toPositiveInt(row.budgetLineId || row.budget_line_id);
    let preAdvanceAmount = moneyOrNull(row.preAdvance || row.pre_advance_amount);
    const advanceAmount = toMoney(row.advance || row.advance_amount);
    if (!budgetHead && !subHead && advanceAmount === 0) continue;

    const uid = toPositiveInt(userId);
    if (uid && (budgetLineId || (budgetHead && subHead))) {
      const summary = await getCumulativeAdvanceSummary(conn, {
        userId: uid,
        budgetLineId,
        head: budgetHead,
        subHead,
      });
      preAdvanceAmount = moneyOrNull(summary.preAdvance);
    }

    await conn.execute(
      `INSERT INTO expenditure_advance_rows
         (expenditure_id, finance_budget_breakup_id, budget_proposal_id, budget_line_id,
          amount_source, budget_head, sub_head, budget_amount, pre_advance_amount,
          advance_amount, available_amount_snapshot, remaining_amount_snapshot,
          unplanned_available_snapshot, sort_order)
       VALUES (?, NULL, ?, ?, 'planned', ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
      [expenditureId, budgetProposalId, budgetLineId, budgetHead, subHead, budgetAmount, preAdvanceAmount, advanceAmount, sortOrder],
    );
    sortOrder += 1;
  }
}

async function insertSettlementRows(conn, expenditureId, rows = []) {
  const validRows = Array.isArray(rows) ? rows : [];
  let sortOrder = 0;
  for (const row of validRows) {
    const budgetHead = sanitizeRowValue(row.budgetHead || row.budget_head);
    const subHead = sanitizeRowValue(row.subHead || row.sub_head);
    const budgetAmount = moneyOrNull(row.budget);
    const budgetProposalId = toPositiveInt(row.budgetProposalId || row.budget_proposal_id);
    const budgetLineId = toPositiveInt(row.budgetLineId || row.budget_line_id);
    const advanceAmount = moneyOrNull(row.advance);
    const settlementAmount = toMoney(row.settlement || row.settlement_amount);
    if (!budgetHead && !subHead && settlementAmount === 0) continue;

    await conn.execute(
      `INSERT INTO expenditure_settlement_rows
         (expenditure_id, finance_budget_breakup_id, budget_proposal_id, budget_line_id,
          amount_source, budget_head, sub_head, budget_amount, advance_amount,
          settlement_amount, available_amount_snapshot, remaining_amount_snapshot,
          unplanned_available_snapshot, sort_order)
       VALUES (?, NULL, ?, ?, 'planned', ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
      [expenditureId, budgetProposalId, budgetLineId, budgetHead, subHead, budgetAmount, advanceAmount, settlementAmount, sortOrder],
    );
    sortOrder += 1;
  }
}

async function insertExpenditureRows(conn, expenditureId, rows = []) {
  const validRows = Array.isArray(rows) ? rows : [];
  let sortOrder = 0;
  for (const row of validRows) {
    const budgetHead = sanitizeRowValue(row.budgetHead || row.budget_head);
    const subHead = sanitizeRowValue(row.subHead || row.sub_head);
    const budgetAmount = moneyOrNull(row.budget);
    const budgetProposalId = toPositiveInt(row.budgetProposalId || row.budget_proposal_id);
    const budgetLineId = toPositiveInt(row.budgetLineId || row.budget_line_id);
    const expenditureInput = sanitizeRowValue(row.expenditure || row.expenditure_input || row.autoSum || row.auto_sum_amount);
    const autoSumAmount = toMoney(row.autoSum || row.auto_sum_amount || row.expenditure);
    if (!budgetHead && !subHead && autoSumAmount === 0 && !expenditureInput) continue;

    await conn.execute(
      `INSERT INTO expenditure_line_rows
         (expenditure_id, finance_budget_breakup_id, budget_proposal_id, budget_line_id,
          amount_source, budget_head, sub_head, budget_amount, expenditure_input,
          auto_sum_amount, available_amount_snapshot, remaining_amount_snapshot,
          unplanned_available_snapshot, sort_order)
       VALUES (?, NULL, ?, ?, 'planned', ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
      [expenditureId, budgetProposalId, budgetLineId, budgetHead, subHead, budgetAmount, expenditureInput, autoSumAmount, sortOrder],
    );
    sortOrder += 1;
  }
}

async function insertBillFiles(conn, expenditureId, files = []) {
  const validFiles = Array.isArray(files) ? files : [];
  let sortOrder = 0;

  for (const file of validFiles) {
    if (!file?.filename || !file?.path) continue;

    await conn.execute(
      `INSERT INTO expenditure_request_bills
         (expenditure_id, payee_row_id, original_name, stored_name, file_path, mime_type, file_size, sort_order)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
      [
        expenditureId,
        sanitizeRowValue(file.originalname),
        sanitizeRowValue(file.filename),
        toStoredUploadPath(file.path),
        sanitizeRowValue(file.mimetype),
        Number(file.size) || 0,
        sortOrder,
      ],
    );
    sortOrder += 1;
  }
}

async function upsertBulkNeftFile(conn, expenditureId, file = null, templateVersion = null) {
  if (!file?.filename || !file?.path) return;

  await conn.execute(
    `INSERT INTO expenditure_bulk_neft_files
       (expenditure_id, template_version, original_name, stored_name, file_path, mime_type, file_size)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       template_version = VALUES(template_version),
       original_name = VALUES(original_name),
       stored_name = VALUES(stored_name),
       file_path = VALUES(file_path),
       mime_type = VALUES(mime_type),
       file_size = VALUES(file_size),
       updated_at = CURRENT_TIMESTAMP`,
    [
      expenditureId,
      sanitizeRowValue(templateVersion) || DEFAULT_BULK_NEFT_TEMPLATE_VERSION,
      sanitizeRowValue(file.originalname),
      sanitizeRowValue(file.filename),
      toStoredUploadPath(file.path),
      sanitizeRowValue(file.mimetype),
      Number(file.size) || 0,
    ],
  );
}

function collectUsageRowsForRequestType(requestType, { advanceRows, expenditureRows } = {}) {
  const usageByLine = new Map();

  const addUsage = (budgetLineId, amount) => {
    const lineId = toPositiveInt(budgetLineId);
    const normalizedAmount = toMoney(amount);
    if (!lineId || normalizedAmount <= 0) return;
    usageByLine.set(lineId, toMoney((usageByLine.get(lineId) || 0) + normalizedAmount));
  };

  if (requestType === 'Advance') {
    (Array.isArray(advanceRows) ? advanceRows : []).forEach((row) => {
      addUsage(row.budgetLineId || row.budget_line_id, row.advance || row.advance_amount);
    });
  } else if (requestType === 'Expenditure') {
    (Array.isArray(expenditureRows) ? expenditureRows : []).forEach((row) => {
      addUsage(row.budgetLineId || row.budget_line_id, row.autoSum || row.auto_sum_amount || row.expenditure);
    });
  }

  return [...usageByLine.entries()].map(([budgetLineId, amount]) => ({ budgetLineId, amount }));
}

async function applyBudgetUsageDelta(conn, usageRows = [], multiplier = 1) {
  for (const usageRow of usageRows) {
    const budgetLineId = toPositiveInt(usageRow.budgetLineId);
    const amount = toMoney(usageRow.amount) * multiplier;
    if (!budgetLineId || amount === 0) continue;

    await conn.execute(
      `INSERT INTO finance_budget_line_usage (budget_line_id, consumed_amount)
       VALUES (?, 0.00)
       ON DUPLICATE KEY UPDATE budget_line_id = budget_line_id`,
      [budgetLineId],
    );

    await conn.execute(
      `UPDATE finance_budget_line_usage
          SET consumed_amount = GREATEST(0, consumed_amount + ?),
              updated_at = CURRENT_TIMESTAMP
        WHERE budget_line_id = ?`,
      [amount, budgetLineId],
    );
  }
}

export async function createExpenditureRequest(data, userId, uploads = {}) {
  return withTransaction(async (conn) => {
    const uid = toPositiveInt(userId);
    if (!uid) {
      throw new Error('Invalid user context');
    }

    const requestType = inferRequestType(data);
    if (!requestType) {
      throw new Error('Invalid request type. Expected Advance, Settlement, or Expenditure.');
    }

    const employeeId = toPositiveInt(data.employee_id);
    let departmentId = null;
    let employee = null;
    if (employeeId) {
      const [rows] = await conn.execute(
        `SELECT e.id, e.department_id, e.email, e.mobile, e.title, e.first_name, e.last_name,
                e.designation, d.name AS department
           FROM master_employees e
           LEFT JOIN master_departments d ON d.id = e.department_id
          WHERE e.id = ?
            AND e.status = 'Active'
          LIMIT 1`,
        [employeeId],
      );
      employee = rows[0] || null;
      departmentId = toPositiveInt(employee?.department_id);
    }

    const workflowContext = await resolveExpenditureWorkflowContext(conn, {
      employee_id: data.employee_id,
      beneficiary_type: data.beneficiary_type,
      beneficiary_value: data.beneficiary_value,
      department_id: data.department_id ?? departmentId,
      beneficiary_entity_id: data.beneficiary_entity_id,
    });

    const requestDate = data.request_date ? new Date(data.request_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const financeRequestId = toPositiveInt(data.finance_request_id);
    if (!financeRequestId) {
      throw new Error('finance_request_id is required');
    }

    const financeOwner = await getApprovedFinanceRequestOwner(conn, financeRequestId);
    if (!financeOwner) {
      throw new Error('Finance request not found or not approved');
    }
    if (toPositiveInt(financeOwner.created_by) !== uid) {
      throw new Error('Access denied for this finance request');
    }

    const paymentDetails = data.payment_details || {};
    const advanceRows = Array.isArray(data.advance_rows) ? data.advance_rows : [];
    const settlementRows = Array.isArray(data.settlement_rows) ? data.settlement_rows : [];
    const expenditureRows = Array.isArray(data.expenditure_rows) ? data.expenditure_rows : [];
    const usageRows = collectUsageRowsForRequestType(requestType, { advanceRows, expenditureRows });

    const advanceTotal = advanceRows.reduce((sum, row) => sum + toMoney(row.advance || row.advance_amount), 0);
    const settlementTotal = settlementRows.reduce((sum, row) => sum + toMoney(row.settlement || row.settlement_amount), 0);
    const expenditureTotal = expenditureRows.reduce((sum, row) => sum + toMoney(row.autoSum || row.expenditure || row.auto_sum_amount), 0);
    const totalAmount = toMoney(advanceTotal + settlementTotal + expenditureTotal);

    if (usageRows.length) {
      const budgetLineIds = usageRows.map((row) => row.budgetLineId);
      const placeholders = budgetLineIds.map(() => '?').join(', ');
      const [budgetRows] = await conn.execute(
        `SELECT
           fbb.budget_line_id,
           GREATEST(
             0,
             COALESCE(
               fbb.remaining_amount_snapshot,
               fbb.available_amount_snapshot,
               COALESCE(
                 bpl.approved_line_total,
                 bpl.line_total,
                 fbb.approved_amount,
                 fbb.amount,
                 0
               ) - COALESCE(fblu.consumed_amount, 0)
             )
           ) AS remaining_amount
         FROM finance_budget_breakup fbb
         LEFT JOIN budget_proposal_lines bpl ON bpl.id = fbb.budget_line_id
         LEFT JOIN finance_budget_line_usage fblu ON fblu.budget_line_id = fbb.budget_line_id
         WHERE fbb.finance_id = ?
           AND fbb.budget_line_id IN (${placeholders})`,
        [financeRequestId, ...budgetLineIds],
      );

      const remainingByLineId = new Map(
        budgetRows.map((row) => [toPositiveInt(row.budget_line_id), toMoney(row.remaining_amount)]),
      );

      for (const usageRow of usageRows) {
        const lineId = toPositiveInt(usageRow.budgetLineId);
        const requestedAmount = toMoney(usageRow.amount);
        const remaining = toMoney(remainingByLineId.get(lineId));

        if (!lineId || !remainingByLineId.has(lineId)) {
          throw new Error(`Budget line ${lineId || 'unknown'} is not linked to this finance request`);
        }
        if (requestedAmount > remaining) {
          throw new Error(
            `Requested amount ${requestedAmount.toFixed(2)} exceeds remaining budget ${remaining.toFixed(2)} for line ${lineId}`,
          );
        }
      }
    }

    const entry = {
      finance_request_id: financeRequestId,
      employee_id: employeeId || null,
      applicant_name: normalizeText(data.applicant_name) || (employee ? `${normalizeText(employee.title)} ${normalizeText(employee.first_name)} ${normalizeText(employee.last_name)}`.trim() : null),
      designation: normalizeText(data.designation) || normalizeText(employee?.designation) || null,
      department: normalizeText(data.department) || normalizeText(employee?.department) || null,
      email: normalizeText(data.email) || normalizeText(employee?.email) || null,
      mobile: normalizeText(data.mobile) || normalizeText(employee?.mobile) || null,
      request_date: requestDate,
      description: normalizeText(data.description) || null,
      beneficiary_type: normalizeBeneficiaryType(data.beneficiary_type)
        || normalizeText(data.beneficiary_type)
        || 'Individual Faculty',
      beneficiary_value: normalizeText(data.beneficiary_value) || null,
      budget_tag: normalizeText(data.budget_tag) || null,
      department_id: workflowContext.departmentId || departmentId,
      beneficiary_entity_id: workflowContext.beneficiaryEntityId,
      primary_head: normalizeText(data.primary_head) || 'General',
      event_sub_head: normalizeText(data.event_sub_head) || null,
      request_type: requestType,
      is_budget_proposed: normalizeText(data.is_budget_proposed) === 'Yes' ? 'Yes' : 'No',
      proposed_amount: moneyOrNull(data.proposed_amount),
      balance_amount: moneyOrNull(data.balance_amount),
      income_type: normalizeText(data.income_type) || null,
      income_status: normalizeText(data.income_status) || null,
      income_amount_type: normalizeText(data.income_amount_type) || null,
      credit_status: normalizeText(data.credit_status) || null,
      debit_status: normalizeDebitStatus(data.debit_status),
      partial_amount: moneyOrNull(data.partial_amount),
      show_bulk_neft: (parseBoolean(data.show_bulk_neft) || Boolean(uploads.bulkNeftFile)) ? 1 : 0,
      payment_mode: normalizeText(paymentDetails.mode || data.payment_mode) || null,
      payment_ref_no: normalizeText(paymentDetails.refNo || data.payment_ref_no) || null,
      payment_date: paymentDetails.date || data.payment_date || null,
      payment_status: normalizePaymentStatus(paymentDetails.status || data.payment_status),
      payment_debit_account: normalizeText(paymentDetails.debitAccount || data.payment_debit_account) || null,
      advance_total_amount: toMoney(advanceTotal),
      settlement_total_amount: toMoney(settlementTotal),
      expenditure_total_amount: toMoney(expenditureTotal),
      total_amount: totalAmount,
      approved_total_amount: 0.00,
      created_by: uid,
      overall_status: 'pending',
    };

    const filteredEntry = Object.fromEntries(
      Object.entries(entry).filter(([, value]) => value !== null && value !== undefined),
    );
    const entryKeys = Object.keys(filteredEntry);
    const entryValues = Object.values(filteredEntry);

    const [result] = await conn.execute(
      `INSERT INTO expenditure_requests (${entryKeys.map((key) => `\`${key}\``).join(', ')})
       VALUES (${entryKeys.map(() => '?').join(', ')})`,
      entryValues,
    );
    const expenditureId = result.insertId;

    const ref = await insertExpenditureRef(conn, expenditureId, requestDate);

    await insertIncomeRows(conn, expenditureId, data.income_rows);
    await insertPayeeRows(conn, expenditureId, data.payee_rows, userId);
    await insertAdvanceRows(conn, expenditureId, data.advance_rows, userId);
    await insertSettlementRows(conn, expenditureId, data.settlement_rows);
    await insertExpenditureRows(conn, expenditureId, data.expenditure_rows);
    await applyBudgetUsageDelta(conn, usageRows, 1);
    await insertBillFiles(conn, expenditureId, uploads.billFiles);
    await upsertBulkNeftFile(
      conn,
      expenditureId,
      uploads.bulkNeftFile,
      data.bulk_neft_template_version,
    );

    return { expenditureId, requestRef: ref };
  });
}

export async function searchApplicant(query = '', employeeType = null) {
  return searchEmployeeApplicants(query, employeeType);
}

/**
 * Fetch a single expenditure request with joined applicant and payee details.
 */
export async function getExpenditureById(id) {
  const [rows] = await db.execute(
    `${EXPENDITURE_SELECT} WHERE er.id = ? LIMIT 1`, [id],
  );
  return rows[0] || null;
}

export async function getExpenditureDetails(id) {
  const expenditureId = toPositiveInt(id);
  if (!expenditureId) {
    return {
      income_rows: [],
      payee_rows: [],
      advance_rows: [],
      settlement_rows: [],
      expenditure_rows: [],
      bill_files: [],
      bulk_neft_file: null,
    };
  }

  const [
    incomeRowsResult,
    payeeRowsResult,
    advanceRowsResult,
    settlementRowsResult,
    expenditureRowsResult,
    billFilesResult,
    bulkNeftFileResult,
  ] = await Promise.all([
    db.execute(
      `SELECT id, income_source, contribution, amount, status, remarks, credit_account, sort_order,
              created_at, updated_at
         FROM expenditure_income_rows
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, payee_id, payee_name, bank_name, account_no, ifsc, branch_name, url, amount, mode,
              account_name, pan_number, account_type, beneficiary_type, beneficiary_org,
              organization_type, msme, gstin, tds_details, tds_section, sort_order,
              created_at, updated_at
         FROM expenditure_payee_rows
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, finance_budget_breakup_id, budget_proposal_id, budget_line_id, amount_source,
              budget_head, sub_head, budget_amount, pre_advance_amount, advance_amount,
              available_amount_snapshot, remaining_amount_snapshot, unplanned_available_snapshot,
              sort_order, created_at, updated_at
         FROM expenditure_advance_rows
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, finance_budget_breakup_id, budget_proposal_id, budget_line_id, amount_source,
              budget_head, sub_head, budget_amount, advance_amount, settlement_amount,
              available_amount_snapshot, remaining_amount_snapshot, unplanned_available_snapshot,
              sort_order, created_at, updated_at
         FROM expenditure_settlement_rows
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, finance_budget_breakup_id, budget_proposal_id, budget_line_id, amount_source,
              budget_head, sub_head, budget_amount, expenditure_input, auto_sum_amount,
              available_amount_snapshot, remaining_amount_snapshot, unplanned_available_snapshot,
              sort_order, created_at, updated_at
         FROM expenditure_line_rows
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, payee_row_id, original_name, stored_name, file_path, mime_type, file_size,
              sort_order, created_at
         FROM expenditure_request_bills
        WHERE expenditure_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [expenditureId],
    ),
    db.execute(
      `SELECT id, template_version, original_name, stored_name, file_path, mime_type, file_size,
              created_at, updated_at
         FROM expenditure_bulk_neft_files
        WHERE expenditure_id = ?
        LIMIT 1`,
      [expenditureId],
    ),
  ]);

  const [income_rows] = incomeRowsResult;
  const [payee_rows] = payeeRowsResult;
  const [advance_rows] = advanceRowsResult;
  const [settlement_rows] = settlementRowsResult;
  const [expenditure_rows] = expenditureRowsResult;
  const [bill_files] = billFilesResult;
  const [bulkNeftRows] = bulkNeftFileResult;

  return {
    income_rows,
    payee_rows,
    advance_rows,
    settlement_rows,
    expenditure_rows,
    bill_files: bill_files.map(withUploadAccess),
    bulk_neft_file: withUploadAccess(bulkNeftRows[0] || null),
  };
}

/**
 * Paginated list of expenditure requests.
 * Supports filters: mine, status, budgetLineId, requestType.
 */
export async function listExpenditures({
  userId,
  mine = false,
  status,
  budgetLineId,
  requestType,
  financeRequestId,
  page  = 1,
  limit = 20,
} = {}) {
  const conditions = [];
  const params     = [];

  if (mine && userId) {
    conditions.push('er.created_by = ?');
    params.push(toPositiveInt(userId));
  }
  if (status) {
    conditions.push('LOWER(TRIM(er.overall_status)) = ?');
    params.push(normalizeText(status).toLowerCase());
  }
  const lineId = toPositiveInt(budgetLineId);
  if (lineId) {
    conditions.push(`(
      EXISTS (
        SELECT 1 FROM expenditure_advance_rows ar
         WHERE ar.expenditure_id = er.id AND ar.budget_line_id = ?
      )
      OR EXISTS (
        SELECT 1 FROM expenditure_settlement_rows sr
         WHERE sr.expenditure_id = er.id AND sr.budget_line_id = ?
      )
      OR EXISTS (
        SELECT 1 FROM expenditure_line_rows lr
         WHERE lr.expenditure_id = er.id AND lr.budget_line_id = ?
      )
    )`);
    params.push(lineId, lineId, lineId);
  }
  if (requestType) {
    conditions.push('UPPER(TRIM(er.request_type)) = ?');
    params.push(normalizeText(requestType).toUpperCase());
  }
  const financeId = toPositiveInt(financeRequestId);
  if (financeId) {
    conditions.push('er.finance_request_id = ?');
    params.push(financeId);
  }

  const where    = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pageNum  = Math.max(Number(page) || 1, 1);
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const offset   = (pageNum - 1) * limitNum;

  const [[{ total }]] = await db.execute(
    `SELECT COUNT(*) AS total FROM expenditure_requests er ${where}`, params,
  );

  const [rows] = await db.execute(
    `${EXPENDITURE_SELECT} ${where} ORDER BY er.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limitNum, offset],
  );

  return { items: rows, total: Number(total), page: pageNum, limit: limitNum };
}

/**
 * Update scalar fields on an expenditure request (payment tracking, status, etc.).
 * Does NOT re-run budget deduction.
 */
export async function updateExpenditure(id, data, actor = null) {
  const ALLOWED = [
    'description', 'payment_debit_account', 'payment_mode',
    'payment_ref_no', 'payment_date', 'payment_status', 'overall_status',
  ];

  const update = Object.fromEntries(
    Object.entries(data)
      .filter(([k, v]) => ALLOWED.includes(k) && v !== undefined)
      .map(([k, v]) => [k, v === '' ? null : v]),
  );

  if (!Object.keys(update).length) return { affectedRows: 0 };

  const [result] = await db.execute(
    'UPDATE expenditure_requests SET ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [update, id],
  );

  try {
    await db.execute(
      `INSERT INTO expenditure_request_edits
         (expenditure_request_id, edited_by_user_id, edited_by_email,
          edited_by_role, is_admin, summary, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        toPositiveInt(actor?.id)                     || null,
        normalizeText(actor?.email)                  || null,
        normalizeText(actor?.role).toLowerCase()     || null,
        Boolean(actor?.isSuperAdmin) ? 1 : 0,
        'Expenditure request updated',
        JSON.stringify({ updatedKeys: Object.keys(update) }),
      ],
    );
  } catch (auditErr) {
    if (auditErr?.code !== 'ER_NO_SUCH_TABLE') throw auditErr;
  }

  return result;
}

/**
 * Delete an expenditure request and release the reserved budget.
 * Only allowed when overall_status = 'pending'.
 */
export async function deleteExpenditure(id) {
  return withTransaction(async (conn) => {
    const [[row]] = await conn.execute(
      `SELECT id, request_type, overall_status
         FROM expenditure_requests WHERE id = ? LIMIT 1 FOR UPDATE`,
      [id],
    );
    if (!row) throw new Error('Expenditure request not found');
    if (normalizeText(row.overall_status).toLowerCase() !== 'pending') {
      throw new Error('Only pending requests can be deleted');
    }

    let usageRows = [];
    if (normalizeText(row.request_type) === 'Advance') {
      const [advanceRows] = await conn.execute(
        `SELECT budget_line_id AS budgetLineId, advance_amount AS amount
           FROM expenditure_advance_rows
          WHERE expenditure_id = ?`,
        [id],
      );
      usageRows = advanceRows;
    } else if (normalizeText(row.request_type) === 'Expenditure') {
      const [expRows] = await conn.execute(
        `SELECT budget_line_id AS budgetLineId, auto_sum_amount AS amount
           FROM expenditure_line_rows
          WHERE expenditure_id = ?`,
        [id],
      );
      usageRows = expRows;
    }
    await applyBudgetUsageDelta(conn, usageRows, -1);

    await conn.execute('DELETE FROM expenditure_requests WHERE id = ?', [id]);
    return true;
  });
}

// ─── Ownership lookup (used by route-level delete guard) ──────────────────────

export async function getExpenditureOwner(id) {
  const n = toPositiveInt(id);
  if (!n) return null;
  const [rows] = await db.execute(
    'SELECT id, created_by FROM expenditure_requests WHERE id = ? LIMIT 1', [n],
  );
  return rows[0] || null;
}

// ─── Applicant auto-fill ──────────────────────────────────────────────────────

/**
 * Return the logged-in user's employee profile for auto-filling the form.
 */
export async function getCurrentEmployee(userId) {
  const [rows] = await db.execute(
    `SELECT
       e.id AS employee_id,
       e.erp_id,
       TRIM(CONCAT(
         COALESCE(e.title,''),' ',e.first_name,' ',COALESCE(e.last_name,'')
       ))             AS name,
       e.designation,
       d.name         AS department,
       e.email,
       e.mobile
     FROM master_employees e
     LEFT JOIN master_departments d ON d.id = e.department_id
     WHERE e.user_id = ? AND e.status = 'Active'
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

// ─── Timeline / status history ────────────────────────────────────────────────

export async function getStatusUpdates(expenditureId) {
  const [workflowRows] = await db.execute(
    `SELECT
       wa.id,
       wa.record_id  AS expenditure_id,
       wa.stage,
       wa.decision   AS status,
       wa.feedback   AS comment,
       wa.decided_at AS created_at,
       wa.actor_email,
       wa.actor_role,
       COALESCE(
         NULLIF(TRIM(CONCAT(
           COALESCE(emp.title,''),' ',
           COALESCE(emp.first_name,''),' ',
           COALESCE(emp.last_name,'')
         )),''),
         u.name
       ) AS actor_name
     FROM workflow_actions wa
     LEFT JOIN users u ON u.id = wa.actor_user_id
     LEFT JOIN master_employees emp
       ON emp.email COLLATE utf8mb4_unicode_ci = wa.actor_email COLLATE utf8mb4_unicode_ci
     WHERE wa.module_key = 'expenditure' AND wa.record_id = ?
     ORDER BY wa.decided_at ASC, wa.id ASC`,
    [expenditureId],
  );

  let editRows = [];
  try {
    const [rows] = await db.execute(
      `SELECT id, expenditure_request_id AS expenditure_id,
              'updated' AS status, summary AS comment,
              created_at, edited_by_email AS actor_email, edited_by_role AS actor_role
         FROM expenditure_request_edits
        WHERE expenditure_request_id = ?
        ORDER BY created_at ASC, id ASC`,
      [expenditureId],
    );
    editRows = rows;
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
  }

  return [...workflowRows, ...editRows].sort((a, b) => {
    const ta = new Date(a.decided_at || a.created_at || 0).getTime();
    const tb = new Date(b.decided_at || b.created_at || 0).getTime();
    return ta !== tb ? ta - tb : (Number(a.id) || 0) - (Number(b.id) || 0);
  });
}
