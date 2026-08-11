import { describe, expect, it, vi } from 'vitest';

import {
  buildRollupQuery,
  buildScopeKey,
  buildWindowTypeSql,
  normalizeRollupRow,
  recalcBudgetAnnualScope,
  resolveProposalScope,
  syncBudgetAnnualForProposal,
  syncBudgetAnnualSafe,
} from '../modules/shared/budget/budgetAnnualRollup.js';

/**
 * Fake connection that records the SQL it is asked to run and replays queued
 * results. Enough to assert the rollup's control flow without a database.
 */
const makeConn = (results = []) => {
  const queue = [...results];
  const calls = [];
  return {
    calls,
    execute: vi.fn(async (sql, params) => {
      calls.push({ sql, params });
      return queue.length ? queue.shift() : [[]];
    }),
  };
};

const TABLE_EXISTS = [[{ count: 1 }]];
const COLUMN_EXISTS = [[{ count: 1 }]];

describe('budgetAnnualRollup', () => {
  describe('normalizeRollupRow', () => {
    it('leaves the sanctioned budget as what remains when nothing is spent', () => {
      const totals = normalizeRollupRow({
        fiscal_year: 2026,
        beneficiary_type: 'Department',
        department_id: 44,
        beneficiary_entity_id: null,
        proposed_total_amount: '6663100.00',
        approved_total_amount: '6663100.00',
        initial_total_amount: '6553600.00',
        additional_total_amount: '109500.00',
        expenditure_total_amount: '0.00',
      });

      expect(totals.initial_total_amount).toBe(6553600);
      expect(totals.additional_total_amount).toBe(109500);
      expect(totals.balance_total_amount).toBe(6663100);
    });

    it('derives balance as the sanctioned budget minus what finance consumed', () => {
      const totals = normalizeRollupRow({
        fiscal_year: 2026,
        beneficiary_type: 'Department',
        department_id: 44,
        proposed_total_amount: 7000000,
        approved_total_amount: 6663100,
        initial_total_amount: 6553600,
        additional_total_amount: 109500,
        expenditure_total_amount: 100000,
      });

      // Balance follows Approved, not Proposed: money that was never sanctioned
      // is not spendable.
      expect(totals.balance_total_amount).toBe(6663100 - 100000);
    });

    it('never double-counts a delta into balance', () => {
      // The old counter wrote balance as (initial + delta) + (additional + delta)
      // - expenditure, and MySQL had already applied the increments to the
      // columns, so balance ran ahead of the totals by the last delta.
      const totals = normalizeRollupRow({
        fiscal_year: 2026,
        beneficiary_type: 'Department',
        department_id: 44,
        proposed_total_amount: 6663100,
        approved_total_amount: 6663100,
        initial_total_amount: 6553600,
        additional_total_amount: 109500,
        expenditure_total_amount: 0,
      });

      expect(totals.balance_total_amount).toBe(totals.approved_total_amount);
    });

    it('derives expenditure rather than carrying a cached value', () => {
      const totals = normalizeRollupRow({
        fiscal_year: 2026,
        beneficiary_type: 'Cell',
        beneficiary_entity_id: 18,
        expenditure_total_amount: '2500.50',
      });

      expect(totals.expenditure_total_amount).toBe(2500.5);
      expect(totals.department_id).toBeNull();
      expect(totals.beneficiary_entity_id).toBe(18);
    });
  });

  describe('buildScopeKey', () => {
    it('treats faculty/staff/department rollups with the same department as one scope', () => {
      const a = buildScopeKey({
        fiscalYear: 2026,
        beneficiaryType: 'Department',
        departmentId: 44,
        entityId: null,
      });
      const b = buildScopeKey({
        fiscalYear: 2026,
        beneficiaryType: 'department',
        departmentId: 44,
        entityId: 0,
      });

      expect(a).toBe(b);
    });

    it('separates a department from an entity of the same name', () => {
      const dept = buildScopeKey({
        fiscalYear: 2026,
        beneficiaryType: 'Department',
        departmentId: 44,
      });
      const cell = buildScopeKey({ fiscalYear: 2026, beneficiaryType: 'Cell', entityId: 44 });

      expect(dept).not.toBe(cell);
    });
  });

  describe('buildRollupQuery', () => {
    it('excludes rejected, returned, archived and deleted proposals', () => {
      const { sql } = buildRollupQuery({ windowTypeSql: buildWindowTypeSql(true) });

      expect(sql).toContain("NOT LIKE '%rejected%'");
      expect(sql).toContain("NOT LIKE '%returned%'");
      expect(sql).toContain("NOT LIKE '%archive%'");
      expect(sql).toContain("<> 'deleted'");
    });

    it('applies the same sanctioned-status rule finance uses to release budget', () => {
      const { sql } = buildRollupQuery({ windowTypeSql: buildWindowTypeSql(true) });

      expect(sql).toContain("IN ('completed', 'approved', 'principal_approved')");
      expect(sql).toContain("LOWER(TRIM(bp.current_stage)) = 'completed'");
    });

    it('keeps Proposed at the requested amount and Approved at the sanctioned one', () => {
      const { sql } = buildRollupQuery({ windowTypeSql: buildWindowTypeSql(true) });

      expect(sql).toContain('SUM(src.requested_amount) AS proposed_total_amount');
      expect(sql).toContain('SUM(src.sanctioned_amount) AS approved_total_amount');
      expect(sql).toContain('COALESCE(bpl.line_total, 0) AS requested_amount');
      expect(sql).toContain('COALESCE(bpl.approved_line_total, bpl.line_total, 0)');
    });

    it('splits the sanctioned budget across the two windows, not the whole pipeline', () => {
      const { sql } = buildRollupQuery({ windowTypeSql: buildWindowTypeSql(true) });

      expect(sql).toContain(
        "SUM(CASE WHEN src.window_type = 'initial' THEN src.sanctioned_amount ELSE 0 END)",
      );
      expect(sql).toContain(
        "SUM(CASE WHEN src.window_type = 'additional' THEN src.sanctioned_amount ELSE 0 END)",
      );
    });

    it("takes expenditure from finance's own consumption record", () => {
      const { sql } = buildRollupQuery({ windowTypeSql: buildWindowTypeSql(true) });

      expect(sql).toContain('LEFT JOIN finance_budget_line_usage fblu');
      expect(sql).toContain('COALESCE(fblu.consumed_amount, 0)');
      expect(sql).toContain('SUM(src.consumed_amount) AS expenditure_total_amount');
    });

    it('ignores consumption on lines whose proposal is no longer sanctioned', () => {
      const { sql } = buildRollupQuery({ windowTypeSql: buildWindowTypeSql(true) });

      // Same reason finance ignores it: there is no budget left to spend from,
      // so counting the spend would drive Balance negative.
      const consumedBranch = sql.slice(sql.indexOf('AS requested_amount'));
      expect(consumedBranch).toContain('THEN COALESCE(fblu.consumed_amount, 0)');
      expect(consumedBranch).toContain('ELSE 0');
    });

    it('falls back to the freeze cutoff when budget_window_type is absent', () => {
      const withColumn = buildRollupQuery({ windowTypeSql: buildWindowTypeSql(true) }).sql;
      const withoutColumn = buildRollupQuery({ windowTypeSql: buildWindowTypeSql(false) }).sql;

      expect(withColumn).toContain('bp.budget_window_type');
      expect(withoutColumn).not.toContain('bp.budget_window_type');
      expect(withoutColumn).toContain('budget_time_freeze_config');
    });

    it('resolves a legacy entity proposal by name when beneficiary_entity_id is unset', () => {
      const { sql } = buildRollupQuery({ windowTypeSql: buildWindowTypeSql(true) });

      // Without this fallback, entity proposals that predate
      // beneficiary_entity_id split off into their own nameless row.
      expect(sql).toContain('COALESCE(NULLIF(bp.beneficiary_entity_id, 0)');
      expect(sql).toContain('legacy_me');
      expect(sql).toContain('LOWER(TRIM(bp.beneficiary_value))');
    });

    it('resolves the legacy entity with a scalar subquery so budget lines cannot multiply', () => {
      const { sql } = buildRollupQuery({ windowTypeSql: buildWindowTypeSql(true) });

      expect(sql).not.toMatch(/JOIN\s+master_entities\s+legacy_me/);
      expect(sql).toContain('LIMIT 1)');
    });

    // The Beneficiary Summary labels a row with `department` first and falls back to
    // `entity_name`, so a non-null department name on an entity scope labelled a Centre/Cell
    // row with the SUBMITTER's department instead of the unit.
    it('nulls the department name for entity scopes, so entity rows are labelled by unit', () => {
      const { sql } = buildRollupQuery({ windowTypeSql: buildWindowTypeSql(true) });
      const squashed = sql.replace(/\s+/g, ' ');

      // A bare `md.name` resolved through bp.department_id for entity proposals too.
      expect(squashed).not.toContain('md.name AS department_name');
      // Guarded on the same entity-type list that nulls scope_department_id, so the name is
      // absent exactly when the department id is.
      expect(squashed).toContain(
        "IN ('centre', 'cell', 'club', 'section', 'professional body', 'professional bodies', 'institution') THEN NULL ELSE md.name END AS department_name",
      );
    });

    it('nulls the entity name for department scopes', () => {
      const { sql } = buildRollupQuery({ windowTypeSql: buildWindowTypeSql(true) });
      const squashed = sql.replace(/\s+/g, ' ');

      expect(squashed).toContain("IN ('department', 'faculty', 'staff') THEN NULL");
    });

    it('threads caller predicates and their params through in order', () => {
      const { sql, params } = buildRollupQuery({
        windowTypeSql: buildWindowTypeSql(true),
        extraWhere: ['bp.fiscal_year = ?', 'bp.department_id = ?'],
        extraParams: [2026, 44],
      });

      expect(sql).toContain('bp.fiscal_year = ?');
      expect(sql).toContain('bp.department_id = ?');
      expect(params).toEqual([2026, 44]);
    });
  });

  describe('resolveProposalScope', () => {
    it('rolls faculty proposals up into the beneficiary department', async () => {
      const conn = makeConn([
        [
          [
            {
              fiscal_year: 2026,
              beneficiary_type: 'Department',
              department_id: 44,
              beneficiary_entity_id: null,
            },
          ],
        ],
      ]);

      const scope = await resolveProposalScope(conn, 257);

      expect(scope).toEqual({
        fiscalYear: 2026,
        beneficiaryType: 'Department',
        departmentId: 44,
        entityId: null,
      });
    });

    it('returns null for an unknown proposal', async () => {
      const conn = makeConn([[[]]]);

      await expect(resolveProposalScope(conn, 999999)).resolves.toBeNull();
    });

    it('ignores a non-numeric id without querying', async () => {
      const conn = makeConn();

      await expect(resolveProposalScope(conn, 'abc')).resolves.toBeNull();
      expect(conn.execute).not.toHaveBeenCalled();
    });
  });

  describe('recalcBudgetAnnualScope', () => {
    const scope = {
      fiscalYear: 2026,
      beneficiaryType: 'Department',
      departmentId: 44,
      entityId: null,
    };

    it('overwrites the cached row with recomputed totals rather than adjusting it', async () => {
      const conn = makeConn([
        COLUMN_EXISTS,
        [
          [
            {
              fiscal_year: 2026,
              beneficiary_type: 'Department',
              department_id: 44,
              beneficiary_entity_id: null,
              proposed_total_amount: 6663100,
              approved_total_amount: 6663100,
              initial_total_amount: 6553600,
              additional_total_amount: 109500,
            },
          ],
        ],
        [[{ id: 32, expenditure_total_amount: 0 }]],
        [{ affectedRows: 1 }],
      ]);

      const result = await recalcBudgetAnnualScope(conn, scope);

      expect(result.action).toBe('updated');
      const update = conn.calls.find((call) => call.sql.includes('UPDATE budget_annual'));
      expect(update.sql).not.toMatch(/=\s*\w+_total_amount\s*[+-]/);
      expect(update.params).toContain(109500);
      expect(update.params).toContain(6553600);
    });

    it('inserts a row when the scope has never been cached', async () => {
      const conn = makeConn([
        COLUMN_EXISTS,
        [
          [
            {
              fiscal_year: 2026,
              beneficiary_type: 'Department',
              department_id: 44,
              beneficiary_entity_id: null,
              proposed_total_amount: 1000,
              approved_total_amount: 1000,
              initial_total_amount: 1000,
              additional_total_amount: 0,
            },
          ],
        ],
        [[]],
        [{ insertId: 91 }],
      ]);

      const result = await recalcBudgetAnnualScope(conn, scope);

      expect(result).toMatchObject({ action: 'inserted', id: 91 });
    });

    it('drops the row when no live proposals remain, instead of leaving a stale total', async () => {
      const conn = makeConn([COLUMN_EXISTS, [[]], [{ affectedRows: 1 }]]);

      const result = await recalcBudgetAnnualScope(conn, scope);

      expect(result.action).toBe('deleted');
      expect(conn.calls.some((call) => call.sql.includes('DELETE FROM budget_annual'))).toBe(true);
    });

    it('reports a no-op when there was no cached row to drop', async () => {
      const conn = makeConn([COLUMN_EXISTS, [[]], [{ affectedRows: 0 }]]);

      const result = await recalcBudgetAnnualScope(conn, scope);

      expect(result.action).toBe('noop');
    });
  });

  describe('syncBudgetAnnualForProposal', () => {
    it('does nothing when the cache table is not deployed', async () => {
      const conn = makeConn([[[{ count: 0 }]]]);

      await expect(syncBudgetAnnualForProposal(1, conn)).resolves.toBeNull();
      expect(conn.calls).toHaveLength(1);
    });

    it('recomputes both the new and the previous scope after a beneficiary change', async () => {
      const conn = makeConn([
        TABLE_EXISTS,
        // resolveProposalScope -> now a Cell
        [
          [
            {
              fiscal_year: 2026,
              beneficiary_type: 'Cell',
              department_id: null,
              beneficiary_entity_id: 18,
            },
          ],
        ],
        // scope 1 recompute
        COLUMN_EXISTS,
        [[]],
        [{ affectedRows: 1 }],
        // scope 2 (previous) recompute
        COLUMN_EXISTS,
        [[]],
        [{ affectedRows: 1 }],
      ]);

      const results = await syncBudgetAnnualForProposal(1199, conn, {
        previousScope: {
          fiscalYear: 2026,
          beneficiaryType: 'Department',
          departmentId: 44,
          entityId: null,
        },
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
      const deletes = conn.calls.filter((call) => call.sql.includes('DELETE FROM budget_annual'));
      expect(deletes).toHaveLength(2);
    });

    it('recomputes a scope once when the previous scope is unchanged', async () => {
      const sameScope = {
        fiscalYear: 2026,
        beneficiaryType: 'Department',
        departmentId: 44,
        entityId: null,
      };
      const conn = makeConn([
        TABLE_EXISTS,
        [
          [
            {
              fiscal_year: 2026,
              beneficiary_type: 'Department',
              department_id: 44,
              beneficiary_entity_id: null,
            },
          ],
        ],
        COLUMN_EXISTS,
        [[]],
        [{ affectedRows: 1 }],
      ]);

      const result = await syncBudgetAnnualForProposal(1199, conn, { previousScope: sameScope });

      expect(Array.isArray(result)).toBe(false);
      expect(
        conn.calls.filter((call) => call.sql.includes('DELETE FROM budget_annual')),
      ).toHaveLength(1);
    });
  });

  describe('syncBudgetAnnualSafe', () => {
    const failingConn = (code) => ({
      calls: [],
      execute: vi.fn(async () => {
        const error = new Error(code || 'cache write failed');
        if (code) error.code = code;
        throw error;
      }),
    });

    it('swallows an ordinary cache failure so it cannot fail the business transaction', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(syncBudgetAnnualSafe(1199, failingConn())).resolves.toBeNull();
      expect(consoleError).toHaveBeenCalled();

      consoleError.mockRestore();
    });

    // InnoDB has already rolled the whole transaction back by this point. Swallowing it would
    // let the caller commit and report a lost approval as a success. Every code here is one
    // mysql2 actually emits — see the note on TRANSACTION_FATAL_ERROR_CODES.
    it.each([
      'ER_LOCK_DEADLOCK',
      'ER_LOCK_WAIT_TIMEOUT',
      'ER_QUERY_INTERRUPTED',
      'PROTOCOL_CONNECTION_LOST',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE',
    ])('re-throws %s so the caller rolls back instead of committing', async (code) => {
      await expect(syncBudgetAnnualSafe(1199, failingConn(code))).rejects.toThrow();
    });

    // A cache-specific failure is the case the swallow exists for.
    it.each(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_DUP_ENTRY'])(
      'still swallows %s, which leaves the transaction usable',
      async (code) => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(syncBudgetAnnualSafe(1199, failingConn(code))).resolves.toBeNull();

        consoleError.mockRestore();
      },
    );
  });
});
