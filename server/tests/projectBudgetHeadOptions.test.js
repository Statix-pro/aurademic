import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({ default: { execute: vi.fn(), query: vi.fn() } }));

const db = (await import('../config/connection.js')).default;
const { default: formOptionsModel } = await import('../modules/formOptions/formOptionsModel.js');

/**
 * The project budget head vocabulary moved out of code and into
 * `project_budget_head_options` so an administrator can curate it. Projects
 * store the head by name and hold no reference to this table, so these cases
 * pin the two rules that protect what is already budgeted: a head in use is
 * never removed, and the same name may exist under two groups but not twice
 * under one.
 */
describe('project budget head options', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it('rejects a second head with the same name in the same group', async () => {
    db.query.mockResolvedValueOnce([[{ id: 3 }]]);

    await expect(
      formOptionsModel.addProjectBudgetHead({ name: 'Equipment', head_group: 'Research Projects' }),
    ).rejects.toMatchObject({ statusCode: 409 });

    // Rejected before the insert, so nothing was written.
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  // `Consumables` is budgeted on a research grant and on a sponsored event
  // alike, and is one head either way — the guard is on the pair, not the name.
  it('allows the same name under a different group', async () => {
    db.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([{ insertId: 21 }]);

    const head = await formOptionsModel.addProjectBudgetHead({
      name: 'Consumables',
      head_group: 'Sponsored Events',
    });

    expect(head).toMatchObject({ id: 21, name: 'Consumables', head_group: 'Sponsored Events' });
  });

  it('deactivates a head that projects have already budgeted under', async () => {
    db.query
      .mockResolvedValueOnce([[{ name: 'Manpower' }]])
      .mockResolvedValueOnce([[{ references_count: 4 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    expect(await formOptionsModel.deleteProjectBudgetHead(7)).toEqual({ deactivated: true });

    const [sql] = db.query.mock.calls[2];
    expect(sql).toContain('UPDATE project_budget_head_options SET is_active = 0');
  });

  it('deletes a head nothing references', async () => {
    db.query
      .mockResolvedValueOnce([[{ name: 'Postage' }]])
      .mockResolvedValueOnce([[{ references_count: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    expect(await formOptionsModel.deleteProjectBudgetHead(9)).toBe(true);

    const [sql] = db.query.mock.calls[2];
    expect(sql).toContain('DELETE FROM project_budget_head_options');
  });

  // The usage check counts the three tables that snapshot the head name, and
  // only the expenditure side of the ledger — an income row's head comes from
  // the fixed `PROJECT_INCOME_HEADS` list, not from this vocabulary.
  it('counts every table that stores the head by name', async () => {
    db.query
      .mockResolvedValueOnce([[{ name: 'Travel' }]])
      .mockResolvedValueOnce([[{ references_count: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await formOptionsModel.deleteProjectBudgetHead(11);

    const [sql, params] = db.query.mock.calls[1];
    expect(sql).toContain('FROM project_budget_heads');
    expect(sql).toContain('FROM project_finance_row_heads');
    expect(sql).toContain("head_kind = 'expenditure'");
    expect(params).toEqual(['Travel', 'Travel', 'Travel']);
  });
});
