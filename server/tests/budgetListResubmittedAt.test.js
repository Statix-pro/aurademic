import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({ default: { execute: vi.fn(), query: vi.fn() } }));

const db = (await import('../config/connection.js')).default;
const { buildBudgetList } = await import('../modules/shared/budget/budgetListBuilder.js');

// The approval queue cards show "Resubmitted on". budget_proposals has no resubmission
// column and updated_at moves on any write, so the date must come from the applicant's
// 'resubmitted' row in the approval log -- and only from that row.
describe('buildBudgetList resubmitted_at', () => {
  beforeEach(() => {
    db.query.mockReset();
    db.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[{ total: 0 }]]);
  });

  it('reads the latest resubmitted decision from the approval log', async () => {
    await buildBudgetList({ role: 'admin', isAdminView: true });

    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(
      /MAX\(CASE WHEN bpa\.decision = 'resubmitted' THEN bpa\.decided_at END\) AS resubmitted_at/,
    );
    expect(sql).not.toMatch(/updated_at\)?\s+AS resubmitted_at/);
  });

  it('returns the column on the applicant list too, which shares the builder', async () => {
    await buildBudgetList({ role: 'faculty', userId: 7, userEmail: 'a@b.c' });

    const [sql] = db.query.mock.calls[0];
    expect(sql).toContain('AS resubmitted_at');
  });
});
