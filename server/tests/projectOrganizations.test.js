import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({ default: { execute: vi.fn(), query: vi.fn() } }));

const db = (await import('../config/connection.js')).default;
const { default: formOptionsModel } = await import('../modules/formOptions/formOptionsModel.js');

/**
 * An organization a project points at is deactivated rather than deleted, so
 * the project keeps its history. The usage check has to count every column that
 * references `project_organizations` — the budget-head and ledger contributor
 * columns were added without it, so an organization named only as a
 * contributor was hard-deleted and every row naming it lost the link.
 */
describe('project organization delete', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it('counts the contributor columns on budget heads and ledger rows', async () => {
    db.query
      .mockResolvedValueOnce([[{ references_count: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await formOptionsModel.deleteProjectOrganization(5);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toContain('project_budget_heads WHERE contribution_organization_id = ?');
    expect(sql).toContain('project_transactions WHERE contribution_organization_id = ?');
    // One placeholder per counted column, each bound to the same id.
    expect(params).toEqual(Array((sql.match(/\?/g) ?? []).length).fill(5));
  });

  it('deactivates an organization something references', async () => {
    db.query
      .mockResolvedValueOnce([[{ references_count: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    expect(await formOptionsModel.deleteProjectOrganization(5)).toEqual({ deactivated: true });

    const [sql] = db.query.mock.calls[1];
    expect(sql).toContain('UPDATE project_organizations SET is_active = 0');
  });

  it('deletes an organization nothing references', async () => {
    db.query
      .mockResolvedValueOnce([[{ references_count: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    expect(await formOptionsModel.deleteProjectOrganization(5)).toBe(true);

    const [sql] = db.query.mock.calls[1];
    expect(sql).toContain('DELETE FROM project_organizations');
  });
});
