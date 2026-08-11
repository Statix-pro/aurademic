/**
 * Rebuilds the `budget_annual` cache from `budget_proposals` /
 * `budget_proposal_lines`.
 *
 * `budget_annual` used to be maintained with `column = column +/- delta`
 * arithmetic, so any missed, repeated, or unmatched delta drifted a row
 * permanently — including into negative territory when a proposal that had
 * never been sanctioned was deleted. Rows are now recomputed instead of
 * incremented, but existing rows still carry the accumulated drift; this script
 * clears it.
 *
 * It also fills in `expenditure_total_amount`, which never had a writer at all
 * and so sat at zero on every row while finance was consuming budget.
 *
 * Usage:
 *   npm run reconcile:budget-annual                # report only, no writes
 *   npm run reconcile:budget-annual -- --apply     # write the corrected rows
 *   npm run reconcile:budget-annual -- --apply --fiscal-year=2026
 *
 * Safe to re-run: the rebuild is idempotent. Run it once after deploying, and
 * any time the Beneficiary Summary is suspected of disagreeing with the
 * proposals behind it.
 */

import '../config/env.js';
import { pathToFileURL } from 'url';

import db from '../config/connection.js';
import {
  buildScopeKey,
  hasBudgetAnnualTable,
  listRollupFiscalYears,
  loadBudgetAnnualCache,
  recalcBudgetAnnualForFiscalYear,
} from '../modules/shared/budget/budgetAnnualRollup.js';

const MONEY_COLUMNS = [
  'proposed_total_amount',
  'approved_total_amount',
  'initial_total_amount',
  'additional_total_amount',
  'expenditure_total_amount',
  'balance_total_amount',
];

function parseArgs(argv) {
  const apply = argv.includes('--apply');
  const fiscalYearArg = argv.find((arg) => arg.startsWith('--fiscal-year='));
  const fiscalYear = fiscalYearArg ? Number.parseInt(fiscalYearArg.split('=')[1], 10) : null;
  return { apply, fiscalYear: Number.isInteger(fiscalYear) ? fiscalYear : null };
}

const formatAmount = (value) =>
  Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

async function snapshotRows(conn, fiscalYear) {
  const [rows] = await conn.execute(
    `SELECT ba.id,
            ba.fiscal_year,
            ba.beneficiary_type,
            ba.department_id,
            COALESCE(ba.entity_id, ba.beneficiary_entity_id) AS entity_id,
            COALESCE(md.name, me.name, ba.beneficiary_type) AS label,
            ba.proposed_total_amount,
            ba.approved_total_amount,
            ba.initial_total_amount,
            ba.additional_total_amount,
            ba.expenditure_total_amount,
            ba.balance_total_amount
       FROM budget_annual ba
       LEFT JOIN master_departments md ON md.id = ba.department_id
       LEFT JOIN master_entities me ON me.id = COALESCE(ba.entity_id, ba.beneficiary_entity_id)
      WHERE ba.fiscal_year = ?`,
    [fiscalYear],
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

export async function reconcileBudgetAnnual({ apply = false, fiscalYear = null } = {}) {
  const conn = await db.getConnection();

  try {
    if (!(await hasBudgetAnnualTable(conn))) {
      console.log('budget_annual table not present — nothing to reconcile.');
      return { fiscalYears: [], changed: 0, negativesFixed: 0 };
    }

    const fiscalYears = fiscalYear ? [fiscalYear] : await listRollupFiscalYears(conn);
    const report = { fiscalYears, changed: 0, negativesFixed: 0, applied: apply };

    console.log(
      `${apply ? 'Rebuilding' : 'Checking (dry run)'} budget_annual for fiscal year(s): ${fiscalYears.join(', ') || 'none'}\n`,
    );

    for (const fy of fiscalYears) {
      const before = await snapshotRows(conn, fy);

      await conn.beginTransaction();
      const summary = await recalcBudgetAnnualForFiscalYear(conn, fy);
      const after = await snapshotRows(conn, fy);
      const cacheAfter = await loadBudgetAnnualCache(conn, fy);

      if (apply) {
        await conn.commit();
      } else {
        await conn.rollback();
      }

      const scopeKeys = new Set([...before.keys(), ...cacheAfter.keys()]);
      const diffs = [];

      for (const scopeKey of scopeKeys) {
        const oldRow = before.get(scopeKey) || null;
        const newRow = after.get(scopeKey) || null;

        if (!oldRow && newRow) {
          diffs.push({ label: newRow.label, kind: 'added', oldRow, newRow });
          continue;
        }
        if (oldRow && !newRow) {
          diffs.push({ label: oldRow.label, kind: 'removed', oldRow, newRow });
          continue;
        }
        if (!oldRow || !newRow) continue;

        const changedColumns = MONEY_COLUMNS.filter(
          (column) => Math.abs(Number(oldRow[column]) - Number(newRow[column])) > 0.01,
        );
        if (changedColumns.length) {
          diffs.push({ label: oldRow.label, kind: 'corrected', oldRow, newRow, changedColumns });
        }
      }

      const negatives = diffs.filter(({ oldRow }) =>
        MONEY_COLUMNS.some((column) => Number(oldRow?.[column]) < 0),
      );

      report.changed += diffs.length;
      report.negativesFixed += negatives.length;

      console.log(
        `FY ${fy}: ${summary.scopes} scope(s) derived, ${diffs.length} row(s) ${apply ? 'corrected' : 'would change'}` +
          (summary.deleted ? `, ${summary.deleted} stale row(s) removed` : ''),
      );

      for (const diff of diffs) {
        if (diff.kind === 'added') {
          console.log(`  + ${diff.label} (was missing from the cache entirely)`);
          continue;
        }
        if (diff.kind === 'removed') {
          console.log(`  - ${diff.label} (no live proposals behind it)`);
          continue;
        }
        console.log(`  ~ ${diff.label}`);
        for (const column of diff.changedColumns) {
          const marker = Number(diff.oldRow[column]) < 0 ? '  <-- negative' : '';
          console.log(
            `      ${column.replace('_total_amount', '').padEnd(11)} ${formatAmount(
              diff.oldRow[column],
            )} -> ${formatAmount(diff.newRow[column])}${marker}`,
          );
        }
      }
      console.log('');
    }

    console.log(
      apply
        ? `Done. ${report.changed} row(s) rebuilt, ${report.negativesFixed} of them previously held a negative total.`
        : `Dry run. ${report.changed} row(s) would change, ${report.negativesFixed} of them currently hold a negative total.\nRe-run with --apply to write them.`,
    );

    return report;
  } finally {
    conn.release();
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  reconcileBudgetAnnual(parseArgs(process.argv.slice(2)))
    .then(() => db.end())
    .catch(async (error) => {
      console.error('Reconciliation failed:', error);
      await db.end().catch(() => {});
      process.exitCode = 1;
    });
}
