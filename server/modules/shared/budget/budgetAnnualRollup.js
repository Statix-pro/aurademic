/**
 * Budget Annual Rollup
 *
 * Single source of truth for beneficiary-level budget totals (the numbers behind
 * Reports -> Budget Dashboard -> Beneficiary Summary).
 *
 * DESIGN RULE: totals are ALWAYS derived from `budget_proposals` +
 * `budget_proposal_lines`. `budget_annual` is a cache of that derivation, never
 * an independent counter.
 *
 * WHO READS WHAT: nothing in the application reads `budget_annual`'s amounts.
 * `listBudgetAnnualSummaryEntries` derives every figure through `buildRollupQuery`
 * on each read, so the report cannot show a stale total. `budget_annual` is a
 * reporting-only snapshot, rebuilt on demand by
 * `npm run reconcile:budget-annual` (see `recalcBudgetAnnualForFiscalYear`).
 *
 * WHY NO WRITE-THROUGH: the per-proposal sync below is deliberately NOT wired into
 * the mutation paths. Maintaining the snapshot inside each approve/edit/delete
 * transaction bought nothing — no reader consumed the amounts — while costing
 * extra in-transaction queries and, because a cache failure must not fail a
 * user's approval, requiring the error to be swallowed. A swallowed error that
 * InnoDB had already turned into a full rollback (a deadlock) would then be
 * committed as a success, silently losing the approval. Deriving on read removes
 * that whole class of failure.
 *
 * TO RE-ENABLE write-through (only if a consumer of the cached amounts appears):
 * call `syncBudgetAnnualSafe(proposalId, conn, { previousScope })` as the last
 * statement of each mutation transaction, passing the `resolveProposalScope`
 * result captured BEFORE the write whenever the beneficiary can change. That
 * helper re-throws transaction-fatal errors for the reason above.
 *
 * Why: `budget_annual` used to be maintained with `column = column +/- delta`
 * arithmetic applied from a handful of mutation sites. Any missed add, repeated
 * add, or subtract-without-a-matching-add drifted the row permanently, and the
 * drift was unbounded in both directions (a delete of a never-approved proposal
 * pushed `additional_total_amount` negative). Recomputing a scope from source is
 * idempotent, so a missed or duplicated call can no longer corrupt anything.
 *
 * A "scope" is one Beneficiary Summary row:
 *   (fiscal_year, beneficiary_type, department_id, entity_id)
 * Faculty/Staff/Department proposals roll up into the beneficiary DEPARTMENT.
 * Entity types (Centre/Cell/Club/Section/Professional Body/Institution) roll up
 * into the ENTITY, with department_id NULL, so the row is labelled by unit name
 * instead of the submitter's department.
 */

import { normalizeText, getCurrentFinancialYear } from './budgetUtils.js';

/**
 * Statuses that must not contribute to any total. Anything rejected, returned,
 * archived or deleted is not a live claim on the budget.
 */
export const ROLLUP_EXCLUDED_STATUS_SQL = `
  LOWER(TRIM(bp.status)) NOT LIKE '%rejected%'
  AND LOWER(TRIM(bp.status)) NOT LIKE '%returned%'
  AND LOWER(TRIM(bp.status)) NOT LIKE '%archive%'
  AND LOWER(TRIM(bp.status)) <> 'deleted'
`;

/**
 * Proposals whose budget actually exists and can be spent against.
 *
 * Deliberately identical to the rule the finance module applies when it decides
 * how much budget a request may consume (`resolveBudgetAvailability` in
 * `modules/finance/financeModel.js`). If the two ever disagree, the dashboard
 * would show budget that finance refuses to release, or hide budget finance
 * happily spends.
 */
export const ROLLUP_SANCTIONED_STATUS_SQL = `
  (
    LOWER(TRIM(bp.status)) IN ('completed', 'approved', 'principal_approved')
    OR LOWER(TRIM(bp.current_stage)) = 'completed'
  )
`;

/**
 * Amount asked for. `Proposed` is the demand, so it stays at the requested
 * value even after an approver revises it downwards — the revision shows up as
 * the gap between Proposed and Approved.
 */
export const ROLLUP_REQUESTED_AMOUNT_SQL = 'COALESCE(bpl.line_total, 0)';

/**
 * Amount sanctioned on a line: the approved value once an approver has set one,
 * otherwise the requested value. Same expression finance treats as the line's
 * budget.
 */
export const ROLLUP_LINE_AMOUNT_SQL = 'COALESCE(bpl.approved_line_total, bpl.line_total, 0)';

/**
 * Amount already spent against a line.
 *
 * `finance_budget_line_usage` is the finance module's own record of consumption
 * (one row per budget line, keyed by its primary key, so it cannot multiply the
 * join) and `finance_budget_usage_ledger` is the event log behind it. Reading it
 * here keeps the dashboard's Expenditure column and finance's availability
 * calculation on the same number instead of inventing a second one.
 *
 * Consumption on a line whose proposal is no longer sanctioned is excluded, for
 * the same reason finance excludes it: there is no budget left to spend from.
 */
export const ROLLUP_CONSUMED_AMOUNT_SQL = 'COALESCE(fblu.consumed_amount, 0)';

const ENTITY_ROLLUP_TYPES_SQL = `('centre', 'cell', 'club', 'section', 'professional body', 'professional bodies', 'institution')`;
const DEPARTMENT_ROLLUP_TYPES_SQL = `('department', 'faculty', 'staff')`;

/** Canonical beneficiary_type for a scope, matching what the client groups by. */
export const ROLLUP_SCOPE_TYPE_SQL = `
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ${DEPARTMENT_ROLLUP_TYPES_SQL} THEN 'Department'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'professional body' THEN 'Professional Body'
    WHEN LOWER(TRIM(bp.beneficiary_type)) = 'professional bodies' THEN 'Professional Body'
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ('centre', 'cell', 'club', 'section', 'institution')
      THEN CONCAT(UPPER(LEFT(TRIM(bp.beneficiary_type), 1)), LOWER(SUBSTRING(TRIM(bp.beneficiary_type), 2)))
    ELSE NULLIF(TRIM(bp.beneficiary_type), '')
  END
`;

export const ROLLUP_SCOPE_DEPARTMENT_SQL = `
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ${ENTITY_ROLLUP_TYPES_SQL} THEN NULL
    ELSE NULLIF(bp.department_id, 0)
  END
`;

/**
 * LEGACY: entity-type proposals created before `beneficiary_entity_id` was
 * populated only carry the unit's name in `beneficiary_value`. Resolving it here
 * keeps them in their unit's row instead of collecting them into a nameless
 * "Institution"/"Centre" row of their own.
 *
 * Written as a scalar subquery rather than a join so it can never multiply the
 * budget lines it decorates; `uq_master_entities_type_name` makes the match
 * unique anyway.
 *
 * Remove once every proposal whose beneficiary_type is an entity type has
 * `beneficiary_entity_id` set:
 *   SELECT COUNT(*) FROM budget_proposals
 *    WHERE LOWER(TRIM(beneficiary_type)) IN ('centre','cell','club','section','professional body','institution')
 *      AND COALESCE(beneficiary_entity_id, 0) <= 0;
 */
const LEGACY_ENTITY_TYPE_CODE_SQL = `
  CASE LOWER(TRIM(bp.beneficiary_type))
    WHEN 'centre' THEN 'CENTRE'
    WHEN 'cell' THEN 'CELL'
    WHEN 'club' THEN 'CLUB'
    WHEN 'section' THEN 'SECTION'
    WHEN 'professional body' THEN 'PROFESSIONAL_BODY'
    WHEN 'professional bodies' THEN 'PROFESSIONAL_BODY'
    WHEN 'institution' THEN 'INSTITUTION'
    ELSE NULL
  END
`;

const legacyEntityLookupSql = (column) => `
  (SELECT legacy_me.${column}
     FROM master_entities legacy_me
     JOIN master_entity_types legacy_met ON legacy_met.id = legacy_me.entity_type_id
    WHERE legacy_me.is_active = 1
      AND legacy_met.code = ${LEGACY_ENTITY_TYPE_CODE_SQL}
      AND LOWER(TRIM(legacy_me.name)) = LOWER(TRIM(bp.beneficiary_value))
    ORDER BY legacy_me.id
    LIMIT 1)
`;

export const ROLLUP_SCOPE_ENTITY_SQL = `
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ${DEPARTMENT_ROLLUP_TYPES_SQL} THEN NULL
    ELSE COALESCE(NULLIF(bp.beneficiary_entity_id, 0), ${legacyEntityLookupSql('id')})
  END
`;

/**
 * Display name for the department a scope belongs to, if it is a department scope.
 *
 * Guarded exactly like `ROLLUP_SCOPE_DEPARTMENT_SQL`, so the name is NULL precisely when
 * `scope_department_id` is. Emitting a bare `md.name` handed every entity scope the SUBMITTER's
 * department name, and because the summary prefers `department` over `entity_name` when
 * labelling a row, a Centre/Cell/Club row was labelled with that department instead of the
 * unit — contradicting the scope rule in this file's header.
 */
export const ROLLUP_DEPARTMENT_NAME_SQL = `
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ${ENTITY_ROLLUP_TYPES_SQL} THEN NULL
    ELSE md.name
  END
`;

/** Display name for the entity a scope belongs to, if it is an entity scope. */
export const ROLLUP_ENTITY_NAME_SQL = `
  CASE
    WHEN LOWER(TRIM(bp.beneficiary_type)) IN ${DEPARTMENT_ROLLUP_TYPES_SQL} THEN NULL
    ELSE COALESCE(me.name, ${legacyEntityLookupSql('name')}, NULLIF(TRIM(bp.beneficiary_value), ''))
  END
`;

/**
 * Whether a proposal belongs to the initial or the additional budget window.
 *
 * Prefers the persisted `budget_window_type`, which `upsertFreezeConfig`
 * rewrites whenever the cutoff date moves.
 *
 * FALLBACK: deployments whose `budget_proposals` table predates the
 * `budget_window_type` column infer the window by comparing the request date
 * against the configured cutoff (or 1 Feb of the fiscal year).
 * Remove this fallback — along with `hasBudgetWindowTypeColumn` and the
 * `hasBudgetWindowTypeColumn` argument — once every deployment has the column,
 * i.e. once this returns a row everywhere:
 *   SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
 *    WHERE TABLE_NAME = 'budget_proposals' AND COLUMN_NAME = 'budget_window_type';
 */
export function buildWindowTypeSql(hasBudgetWindowTypeColumn) {
  const persistedWindow = hasBudgetWindowTypeColumn
    ? "NULLIF(LOWER(TRIM(bp.budget_window_type)), '')"
    : 'NULL';

  return `
    COALESCE(
      ${persistedWindow},
      CASE
        WHEN COALESCE(bp.request_date, DATE(bp.created_at)) <= COALESCE(
          (
            SELECT btf.cutoff_date
            FROM budget_time_freeze_config btf
            WHERE btf.fiscal_year = bp.fiscal_year
            LIMIT 1
          ),
          STR_TO_DATE(CONCAT(bp.fiscal_year, '-02-01'), '%Y-%m-%d')
        ) THEN 'initial'
        ELSE 'additional'
      END
    )
  `;
}

export async function hasBudgetAnnualTable(conn) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'budget_annual'`,
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

export async function hasBudgetWindowTypeColumn(conn) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'budget_proposals'
        AND COLUMN_NAME = 'budget_window_type'`,
  );
  return Number(rows?.[0]?.count || 0) > 0;
}

/**
 * Stable key for a scope, used to line derived rows up with cached rows.
 */
export function buildScopeKey({ fiscalYear, beneficiaryType, departmentId, entityId }) {
  const type = normalizeText(beneficiaryType).toLowerCase() || 'unknown';
  const dept = Number(departmentId) > 0 ? Number(departmentId) : 0;
  const entity = Number(entityId) > 0 ? Number(entityId) : 0;
  return `${Number(fiscalYear) || 0}::${type}::${dept}::${entity}`;
}

/**
 * The rollup query. Aggregates budget lines into one row per scope.
 *
 * Column meanings, chosen so a row reads consistently and so "budget" means the
 * same thing here as it does in the finance module:
 *
 *   Proposed              what beneficiaries asked for, including in-flight
 *                         proposals — demand, not budget
 *   Approved              what has been sanctioned
 *   Initial + Additional  the sanctioned budget split by request window, so the
 *                         two always add up to Approved
 *   Expenditure           what finance has consumed against it
 *   Balance               Approved - Expenditure
 *
 * @param {object} options
 * @param {string} options.windowTypeSql   Output of buildWindowTypeSql().
 * @param {string[]} [options.extraWhere]  Additional predicates on bp/md/me.
 * @param {any[]} [options.extraParams]    Params for extraWhere, in order.
 * @returns {{ sql: string, params: any[] }}
 */
export function buildRollupQuery({ windowTypeSql, extraWhere = [], extraParams = [] }) {
  const where = [ROLLUP_EXCLUDED_STATUS_SQL, ...extraWhere];

  const sql = `
    SELECT
      src.fiscal_year,
      src.scope_type AS beneficiary_type,
      src.scope_department_id AS department_id,
      src.scope_entity_id AS beneficiary_entity_id,
      MAX(src.department_name) AS department,
      MAX(src.entity_name) AS entity_name,
      SUM(src.requested_amount) AS proposed_total_amount,
      SUM(src.sanctioned_amount) AS approved_total_amount,
      SUM(CASE WHEN src.window_type = 'initial' THEN src.sanctioned_amount ELSE 0 END) AS initial_total_amount,
      SUM(CASE WHEN src.window_type = 'additional' THEN src.sanctioned_amount ELSE 0 END) AS additional_total_amount,
      SUM(src.consumed_amount) AS expenditure_total_amount
    FROM (
      SELECT
        bp.fiscal_year AS fiscal_year,
        ${ROLLUP_SCOPE_TYPE_SQL} AS scope_type,
        ${ROLLUP_SCOPE_DEPARTMENT_SQL} AS scope_department_id,
        ${ROLLUP_SCOPE_ENTITY_SQL} AS scope_entity_id,
        ${ROLLUP_DEPARTMENT_NAME_SQL} AS department_name,
        ${ROLLUP_ENTITY_NAME_SQL} AS entity_name,
        ${windowTypeSql} AS window_type,
        ${ROLLUP_REQUESTED_AMOUNT_SQL} AS requested_amount,
        CASE WHEN ${ROLLUP_SANCTIONED_STATUS_SQL} THEN ${ROLLUP_LINE_AMOUNT_SQL} ELSE 0 END
          AS sanctioned_amount,
        CASE WHEN ${ROLLUP_SANCTIONED_STATUS_SQL} THEN ${ROLLUP_CONSUMED_AMOUNT_SQL} ELSE 0 END
          AS consumed_amount
      FROM budget_proposals bp
      JOIN budget_proposal_lines bpl ON bpl.budget_proposal_id = bp.id
      LEFT JOIN finance_budget_line_usage fblu ON fblu.budget_line_id = bpl.id
      LEFT JOIN master_departments md ON md.id = bp.department_id
      LEFT JOIN master_entities me ON me.id = bp.beneficiary_entity_id
      WHERE ${where.join(' AND ')}
    ) src
    GROUP BY src.fiscal_year, src.scope_type, src.scope_department_id, src.scope_entity_id
  `;

  return { sql, params: [...extraParams] };
}

const toMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

/**
 * Normalize a rollup row into the shape `budget_annual` stores and the
 * dashboard consumes.
 *
 * Every column is derived, including expenditure — the cache holds no
 * independently maintained value any more.
 */
export function normalizeRollupRow(row) {
  const approved = toMoney(row.approved_total_amount);
  const expenditure = toMoney(row.expenditure_total_amount);

  return {
    fiscal_year: Number(row.fiscal_year),
    beneficiary_type: normalizeText(row.beneficiary_type) || 'Unknown',
    department_id: Number(row.department_id) > 0 ? Number(row.department_id) : null,
    beneficiary_entity_id:
      Number(row.beneficiary_entity_id) > 0 ? Number(row.beneficiary_entity_id) : null,
    proposed_total_amount: toMoney(row.proposed_total_amount),
    approved_total_amount: approved,
    initial_total_amount: toMoney(row.initial_total_amount),
    additional_total_amount: toMoney(row.additional_total_amount),
    expenditure_total_amount: expenditure,
    balance_total_amount: toMoney(approved - expenditure),
    annual_total_amount: approved,
  };
}

/**
 * Read the cached rows for a fiscal year, keyed by scope.
 */
export async function loadBudgetAnnualCache(conn, fiscalYear) {
  const [rows] = await conn.execute(
    `SELECT id,
            fiscal_year,
            beneficiary_type,
            department_id,
            COALESCE(entity_id, beneficiary_entity_id) AS entity_id
       FROM budget_annual
      WHERE fiscal_year = ?`,
    [Number(fiscalYear)],
  );

  const byScope = new Map();
  for (const row of rows) {
    byScope.set(
      buildScopeKey({
        fiscalYear: row.fiscal_year,
        beneficiaryType: row.beneficiary_type,
        departmentId: row.department_id,
        entityId: row.entity_id,
      }),
      row,
    );
  }
  return byScope;
}

/**
 * Find the cached row for one scope.
 *
 * Scopes are matched with `<=>` because exactly one of department_id /
 * entity_id is always NULL, so plain `=` would never match.
 */
async function findScopeRow(conn, { fiscalYear, beneficiaryType, departmentId, entityId }) {
  const [rows] = await conn.execute(
    `SELECT id
       FROM budget_annual
      WHERE fiscal_year = ?
        AND LOWER(TRIM(beneficiary_type)) = LOWER(TRIM(?))
        AND department_id <=> ?
        AND COALESCE(entity_id, beneficiary_entity_id) <=> ?
      ORDER BY id
      LIMIT 1`,
    [Number(fiscalYear), normalizeText(beneficiaryType), departmentId, entityId],
  );
  return rows?.[0] || null;
}

/**
 * Write one recomputed scope into the cache.
 *
 * Takes the existing row rather than relying on UPDATE affectedRows: the unique
 * key spans nullable columns, and a recompute that changes nothing reports 0
 * affected rows, so an "affectedRows === 0 means insert" check would silently
 * create duplicate scope rows.
 */
async function upsertScopeRow(conn, totals, existingRow = null) {
  if (existingRow?.id) {
    await conn.execute(
      `UPDATE budget_annual
          SET beneficiary_entity_id = ?,
              entity_id = ?,
              proposed_total_amount = ?,
              approved_total_amount = ?,
              initial_total_amount = ?,
              additional_total_amount = ?,
              expenditure_total_amount = ?,
              balance_total_amount = ?,
              annual_total_amount = ?
        WHERE id = ?`,
      [
        totals.beneficiary_entity_id,
        totals.beneficiary_entity_id,
        totals.proposed_total_amount,
        totals.approved_total_amount,
        totals.initial_total_amount,
        totals.additional_total_amount,
        totals.expenditure_total_amount,
        totals.balance_total_amount,
        totals.annual_total_amount,
        existingRow.id,
      ],
    );
    return { action: 'updated', id: existingRow.id };
  }

  const [result] = await conn.execute(
    `INSERT INTO budget_annual (
        fiscal_year,
        beneficiary_type,
        beneficiary_entity_id,
        department_id,
        entity_id,
        proposed_total_amount,
        approved_total_amount,
        initial_total_amount,
        additional_total_amount,
        expenditure_total_amount,
        balance_total_amount,
        annual_total_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      totals.fiscal_year,
      totals.beneficiary_type,
      totals.beneficiary_entity_id,
      totals.department_id,
      totals.beneficiary_entity_id,
      totals.proposed_total_amount,
      totals.approved_total_amount,
      totals.initial_total_amount,
      totals.additional_total_amount,
      totals.expenditure_total_amount,
      totals.balance_total_amount,
      totals.annual_total_amount,
    ],
  );
  return { action: 'inserted', id: result.insertId };
}

async function deleteEmptyScopeRow(conn, { fiscalYear, beneficiaryType, departmentId, entityId }) {
  const [result] = await conn.execute(
    `DELETE FROM budget_annual
      WHERE fiscal_year = ?
        AND LOWER(TRIM(beneficiary_type)) = LOWER(TRIM(?))
        AND department_id <=> ?
        AND COALESCE(entity_id, beneficiary_entity_id) <=> ?`,
    [Number(fiscalYear), normalizeText(beneficiaryType), departmentId, entityId],
  );
  return Number(result?.affectedRows || 0);
}

/**
 * Which Beneficiary Summary row a proposal currently rolls up into.
 *
 * Capture this BEFORE an edit that can move a proposal to another beneficiary,
 * and pass it back as `previousScope` so the row it left is recomputed too.
 */
export async function resolveProposalScope(conn, proposalId) {
  const id = Number(proposalId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const [rows] = await conn.execute(
    `SELECT bp.fiscal_year AS fiscal_year,
            ${ROLLUP_SCOPE_TYPE_SQL} AS beneficiary_type,
            ${ROLLUP_SCOPE_DEPARTMENT_SQL} AS department_id,
            ${ROLLUP_SCOPE_ENTITY_SQL} AS beneficiary_entity_id
       FROM budget_proposals bp
      WHERE bp.id = ?
      LIMIT 1`,
    [id],
  );

  const row = rows?.[0];
  if (!row || !normalizeText(row.beneficiary_type)) return null;

  return {
    fiscalYear: Number(row.fiscal_year),
    beneficiaryType: normalizeText(row.beneficiary_type),
    departmentId: Number(row.department_id) > 0 ? Number(row.department_id) : null,
    entityId: Number(row.beneficiary_entity_id) > 0 ? Number(row.beneficiary_entity_id) : null,
  };
}

/**
 * Recompute the cache for the scope(s) a proposal touches.
 *
 * Safe to call from any mutation path, any number of times, in any order — it
 * reads the current truth and overwrites. Call it AFTER the status/amount
 * writes, inside the same transaction.
 *
 * @param {number} proposalId
 * @param {object} conn                   Transaction connection.
 * @param {object} [options]
 * @param {object|null} [options.previousScope]  Scope the proposal left, from
 *   `resolveProposalScope` before the edit.
 */
export async function syncBudgetAnnualForProposal(proposalId, conn, { previousScope } = {}) {
  const id = Number(proposalId);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!(await hasBudgetAnnualTable(conn))) return null;

  const scopes = [];
  const seen = new Set();
  for (const scope of [await resolveProposalScope(conn, id), previousScope]) {
    if (!scope) continue;
    const key = buildScopeKey(scope);
    if (seen.has(key)) continue;
    seen.add(key);
    scopes.push(scope);
  }

  const results = [];
  for (const scope of scopes) {
    results.push(await recalcBudgetAnnualScope(conn, scope));
  }
  return results.length === 1 ? results[0] : results;
}

/**
 * Errors that mean the caller's transaction is already gone.
 *
 * InnoDB rolls the WHOLE transaction back on a deadlock, and does the same on a
 * lock-wait timeout when `innodb_rollback_on_timeout` is set; a broken or timed-out
 * connection ends it too. These must never be swallowed: the caller commits as
 * soon as its callback returns, so hiding one of these turns a rolled-back
 * approval into a silent success — the business writes are gone and the user is
 * told they succeeded.
 *
 * Every name below is one mysql2 actually produces, checked against the installed
 * driver — a name it never emits would sit here looking like protection while
 * matching nothing:
 *   ER_LOCK_DEADLOCK / ER_LOCK_WAIT_TIMEOUT / ER_QUERY_INTERRUPTED
 *     server error names, in mysql2/lib/constants/errors.js.
 *   PROTOCOL_CONNECTION_LOST   set in mysql2/lib/base/connection.js when the
 *                              connection dies mid-command.
 *   ETIMEDOUT                  set by the same file's connect-timeout handler.
 *   ECONNRESET / EPIPE         socket deaths it propagates verbatim; the driver
 *                              names both as the errors that precede a lost
 *                              connection.
 */
const TRANSACTION_FATAL_ERROR_CODES = new Set([
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT',
  'ER_QUERY_INTERRUPTED',
  'PROTOCOL_CONNECTION_LOST',
  'ETIMEDOUT',
  'ECONNRESET',
  'EPIPE',
]);

export function isTransactionFatalError(error) {
  return TRANSACTION_FATAL_ERROR_CODES.has(error?.code);
}

/**
 * `syncBudgetAnnualForProposal` for mutation paths that must not fail when only
 * the cache write fails.
 *
 * A stale cache row is recoverable — `npm run reconcile:budget-annual` rebuilds
 * it from source — so an ordinary cache error is logged and swallowed rather
 * than failing the user's approval. Errors that already killed the transaction
 * are re-thrown instead, so the caller rolls back and reports failure honestly.
 *
 * Shared by budgetModel and adminBudgetModel so the two cannot drift.
 */
export async function syncBudgetAnnualSafe(proposalId, conn, { previousScope = null } = {}) {
  try {
    return await syncBudgetAnnualForProposal(proposalId, conn, { previousScope });
  } catch (error) {
    if (isTransactionFatalError(error)) {
      throw error;
    }
    console.error(`budget_annual sync failed for proposal ${proposalId}:`, error?.message || error);
    return null;
  }
}

/**
 * Recompute one scope from source and write it to the cache.
 */
export async function recalcBudgetAnnualScope(
  conn,
  { fiscalYear, beneficiaryType, departmentId = null, entityId = null },
) {
  const fy = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
  const windowTypeSql = buildWindowTypeSql(await hasBudgetWindowTypeColumn(conn));

  const { sql, params } = buildRollupQuery({
    windowTypeSql,
    extraWhere: [
      'bp.fiscal_year = ?',
      `${ROLLUP_SCOPE_TYPE_SQL} = ?`,
      `${ROLLUP_SCOPE_DEPARTMENT_SQL} <=> ?`,
      `${ROLLUP_SCOPE_ENTITY_SQL} <=> ?`,
    ],
    extraParams: [fy, normalizeText(beneficiaryType), departmentId, entityId],
  });

  const [rows] = await conn.execute(sql, params);
  const scopeIdentity = {
    fiscalYear: fy,
    beneficiaryType: normalizeText(beneficiaryType),
    departmentId,
    entityId,
  };

  if (!rows.length) {
    // No live proposals left in this scope, so it has neither budget nor
    // spendable balance. Drop the row instead of leaving a stale total behind.
    const removed = await deleteEmptyScopeRow(conn, scopeIdentity);
    return { action: removed > 0 ? 'deleted' : 'noop', scope: scopeIdentity };
  }

  const existingRow = await findScopeRow(conn, scopeIdentity);
  const totals = normalizeRollupRow(rows[0]);
  const result = await upsertScopeRow(conn, totals, existingRow);
  return { ...result, scope: scopeIdentity, totals };
}

/**
 * Rebuild every scope of a fiscal year. Used when the freeze cutoff moves
 * (which reclassifies initial/additional for the whole year) and by
 * `server/scripts/reconcile-budget-annual.js`.
 */
export async function recalcBudgetAnnualForFiscalYear(conn, fiscalYear) {
  const fy = Number.parseInt(fiscalYear, 10) || getCurrentFinancialYear();
  if (!(await hasBudgetAnnualTable(conn))) {
    return { fiscalYear: fy, updated: 0, inserted: 0, deleted: 0 };
  }

  const windowTypeSql = buildWindowTypeSql(await hasBudgetWindowTypeColumn(conn));
  const { sql, params } = buildRollupQuery({
    windowTypeSql,
    extraWhere: ['bp.fiscal_year = ?', `${ROLLUP_SCOPE_TYPE_SQL} IS NOT NULL`],
    extraParams: [fy],
  });

  const [rows] = await conn.execute(sql, params);
  const cache = await loadBudgetAnnualCache(conn, fy);
  const summary = { fiscalYear: fy, updated: 0, inserted: 0, deleted: 0, scopes: rows.length };
  const seen = new Set();

  for (const row of rows) {
    const scopeKey = buildScopeKey({
      fiscalYear: fy,
      beneficiaryType: row.beneficiary_type,
      departmentId: row.department_id,
      entityId: row.beneficiary_entity_id,
    });
    seen.add(scopeKey);

    const cachedRow = cache.get(scopeKey) || null;
    const totals = normalizeRollupRow(row);
    const { action } = await upsertScopeRow(conn, totals, cachedRow);
    if (action === 'inserted') summary.inserted += 1;
    else summary.updated += 1;
  }

  // Cached rows with no live proposals behind them are stale by definition.
  for (const [scopeKey, cachedRow] of cache.entries()) {
    if (seen.has(scopeKey)) continue;
    summary.deleted += await deleteEmptyScopeRow(conn, {
      fiscalYear: fy,
      beneficiaryType: cachedRow.beneficiary_type,
      departmentId: cachedRow.department_id,
      entityId: cachedRow.entity_id,
    });
  }

  return summary;
}

/**
 * Fiscal years that have either proposals or cached rows.
 */
export async function listRollupFiscalYears(conn) {
  const [rows] = await conn.execute(
    `SELECT DISTINCT fiscal_year FROM budget_proposals
      UNION
     SELECT DISTINCT fiscal_year FROM budget_annual
     ORDER BY fiscal_year`,
  );
  return rows.map((row) => Number(row.fiscal_year)).filter((year) => Number.isInteger(year));
}
