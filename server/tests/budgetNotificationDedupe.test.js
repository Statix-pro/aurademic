/**
 * Budget's dedupe keys, for the transitions that legitimately repeat.
 *
 * A proposal is returned and resubmitted, so it reaches the same stage more
 * than once and each arrival is real news. `notification_events.dedupe_key` is
 * UNIQUE, so a key naming only the proposal and the stage would silence every
 * round after the first.
 *
 * These pin the key to the `budget_proposal_approvals` row that caused the
 * transition — unique per decision, and rolled back with it — and pin the
 * no-id case to `null`, because a key built from something ever-changing (a
 * timestamp, say) can never match and so is not deduplication at all.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../modules/notification/notificationService.js', () => ({
  default: { emit: vi.fn() },
}));

import notificationService from '../modules/notification/notificationService.js';
import budgetNotifications from '../modules/shared/budget/budgetNotifications.js';

const proposal = {
  id: 42,
  user_id: 7,
  employee_id: null,
  fiscal_year: '2026-27',
  department_id: 3,
  applicant_name: 'A. Applicant',
};

/** The dedupe key of the emit whose type ends in `suffix`. */
const keyFor = (suffix) => {
  const call = notificationService.emit.mock.calls.find(([arg]) => arg.type.endsWith(suffix));
  return call?.[0]?.dedupeKey;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('budget dedupe keys', () => {
  it('keys a resubmission on the approval row, so a second round still notifies', async () => {
    await budgetNotifications.notifyBudgetResubmitted({
      proposal,
      stage: 'level1',
      approvalId: 501,
    });
    await budgetNotifications.notifyBudgetResubmitted({
      proposal,
      stage: 'level1',
      approvalId: 502,
    });

    const keys = notificationService.emit.mock.calls.map(([arg]) => arg.dedupeKey);
    expect(keys).toEqual(['budget:42:resubmitted:level1:501', 'budget:42:resubmitted:level1:502']);
  });

  it('keys a stage advance on the approval row', async () => {
    await budgetNotifications.notifyBudgetDecision({
      proposal,
      decision: 'approved',
      stage: 'level1',
      nextStage: 'dof',
      approvalId: 601,
    });

    expect(keyFor('stage_advanced')).toBe('budget:42:stage:dof:601');
  });

  it('re-emits the same key for a retried transaction, so the duplicate is suppressed', async () => {
    const args = {
      proposal,
      decision: 'returned',
      stage: 'dof',
      feedback: 'Revise the amounts',
      approvalId: 700,
    };

    await budgetNotifications.notifyBudgetDecision(args);
    await budgetNotifications.notifyBudgetDecision(args);

    const keys = notificationService.emit.mock.calls.map(([arg]) => arg.dedupeKey);
    expect(keys).toEqual(['budget:42:returned:dof:700', 'budget:42:returned:dof:700']);
  });

  it('keys an amounts revision and an archive toggle on their approval rows', async () => {
    await budgetNotifications.notifyBudgetAmountsUpdated({ proposal, approvalId: 801 });
    await budgetNotifications.notifyBudgetArchiveToggled({
      proposal,
      unarchived: true,
      approvalId: 802,
    });

    const keys = notificationService.emit.mock.calls.map(([arg]) => arg.dedupeKey);
    expect(keys).toEqual(['budget:42:amounts:801', 'budget:42:archive:off:802']);
  });

  it('leaves dedupe off rather than inventing a key when there is no approval row', async () => {
    await budgetNotifications.notifyBudgetDecision({
      proposal,
      decision: 'approved',
      stage: 'level1',
      nextStage: 'dof',
    });
    await budgetNotifications.notifyBudgetAmountsUpdated({ proposal });

    const keys = notificationService.emit.mock.calls.map(([arg]) => arg.dedupeKey);
    expect(keys).toEqual([null, null]);
  });

  it('still collapses the once-only outcomes on a stable key', async () => {
    await budgetNotifications.notifyBudgetDecision({
      proposal,
      decision: 'approved',
      stage: 'principal',
      nextStage: 'completed',
    });
    await budgetNotifications.notifyBudgetDecision({
      proposal,
      decision: 'rejected',
      stage: 'dof',
      feedback: 'No',
    });

    expect(keyFor('approved')).toBe('budget:42:approved');
    expect(keyFor('rejected')).toBe('budget:42:rejected:dof');
  });
});
