/**
 * Notification emits for the budget domain.
 *
 * Budget does not run on the generic workflow engine — `budgetModel` and
 * `adminBudgetModel` each re-implement the stage transition inline — so there is
 * no single chokepoint to hook the way finance and expenditure have. (Note that
 * `budgetApprovalEngine.js` looks like that chokepoint but is dead code: nothing
 * imports it, so hooking it would emit nothing.)
 *
 * This module is the next best thing: one place that knows how a budget
 * proposal maps onto notification types and audiences, called from both models.
 * Keeping it here rather than inline in each model is what stops the two
 * `processApproval` implementations from drifting into two different
 * vocabularies for the same event.
 *
 * Every function here is fire-and-forget. `notificationService.emit` swallows
 * its own failures, so a budget approval never fails because of a notification.
 * The single exception is a failure that has already killed the transaction the
 * approval is running in (a deadlock, a dropped connection): that propagates,
 * because the approval is doomed either way and must not commit as a success.
 */

import notificationService from '../../notification/notificationService.js';

const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalize = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

/**
 * A proposal has two owners and they are often different people: `user_id` is
 * whoever submitted it, `employee_id` is the employee it was raised on behalf
 * of. `validateUserAccess` in budgetModel already treats both as owners, so
 * both are told.
 */
const ownerAudience = (proposal) => {
  const audience = [];

  const userId = toPositiveInt(proposal?.user_id);
  if (userId) audience.push({ kind: 'user', userId, recipientRole: 'applicant' });

  const employeeId = toPositiveInt(proposal?.employee_id);
  if (employeeId) audience.push({ kind: 'employee', employeeId, recipientRole: 'applicant' });

  return audience;
};

/**
 * Whoever may act on `stage` for this proposal. `workflow_stage` resolves the
 * department/entity narrowing from `workflow_stage_policies`, so a department's
 * proposal reaches that department's approvers rather than every HOD.
 */
const stageAudience = (proposal, stage) => ({
  kind: 'workflow_stage',
  moduleKey: 'budget',
  stageKey: normalize(stage),
  departmentId: toPositiveInt(proposal?.department_id),
  entityId: toPositiveInt(proposal?.beneficiary_entity_id),
  beneficiaryType: proposal?.beneficiary_type ?? null,
  recipientRole: 'approver',
});

const subjectOf = (proposal) => ({
  moduleKey: 'budget',
  recordId: toPositiveInt(proposal?.id),
  reference: proposal?.fiscal_year ? `FY ${proposal.fiscal_year}` : null,
  applicantName: proposal?.applicant_name || null,
  applicantUserId: toPositiveInt(proposal?.user_id),
});

/**
 * Dedupe keys for the transitions that can happen more than once.
 *
 * A proposal returned and resubmitted reaches the same stage again, and each
 * arrival is real news, so these cannot be keyed on the stage alone. What makes
 * one round distinct is the `budget_proposal_approvals` row the caller has just
 * written: its id is unique per decision and rolls back with the transaction,
 * which is exactly the idempotency scope wanted — a retried transaction (the
 * deadlock path in `notificationService`) re-emits with the same id and the
 * duplicate is suppressed.
 *
 * With no id to hand, dedupe is left off rather than keyed on something like a
 * timestamp: a key that can never match is not deduplication, it just fills the
 * unique index with single-use values and reads like an idempotency guarantee
 * that is not there. Same choice, and the same reason, as `workflowService`.
 */
const roundKey = (proposalId, suffix, approvalId) => {
  const round = toPositiveInt(approvalId);
  return round ? `budget:${proposalId}:${suffix}:${round}` : null;
};

/** A proposal has arrived at its first stage. */
export async function notifyBudgetSubmitted({ proposal, stage, actorUserId = null, tx }) {
  const stageKey = normalize(stage);
  // A proposal created directly by DoF is born complete; there is no queue to
  // announce it to.
  if (!stageKey || ['completed', 'archived', 'deleted'].includes(stageKey)) return;

  await notificationService.emit({
    type: 'budget.submitted',
    actorUserId,
    subject: subjectOf(proposal),
    audience: [stageAudience(proposal, stageKey)],
    data: { stage: stageKey },
    dedupeKey: `budget:${proposal?.id}:submitted:${stageKey}`,
    tx,
  });
}

/** An applicant edited a returned proposal and sent it back. */
export async function notifyBudgetResubmitted({
  proposal,
  stage,
  actorUserId = null,
  approvalId = null,
  tx,
}) {
  const stageKey = normalize(stage);
  if (!stageKey || ['completed', 'archived', 'deleted'].includes(stageKey)) return;

  await notificationService.emit({
    type: 'budget.resubmitted',
    actorUserId,
    subject: subjectOf(proposal),
    audience: [stageAudience(proposal, stageKey)],
    data: { stage: stageKey },
    dedupeKey: roundKey(proposal?.id, `resubmitted:${stageKey}`, approvalId),
    tx,
  });
}

/**
 * An approver decided. Who hears about it depends entirely on what they decided,
 * which is why this branches rather than sending one generic "status changed".
 */
export async function notifyBudgetDecision({
  proposal,
  decision,
  stage,
  nextStage,
  feedback = null,
  actorUserId = null,
  approvalId = null,
  tx,
}) {
  const decided = normalize(decision);
  const from = normalize(stage);
  const to = normalize(nextStage);

  const common = {
    actorUserId,
    subject: subjectOf(proposal),
    data: { stage: from, feedback: feedback || null },
    tx,
  };

  if (decided === 'rejected') {
    await notificationService.emit({
      ...common,
      type: 'budget.rejected',
      audience: ownerAudience(proposal),
      dedupeKey: `budget:${proposal?.id}:rejected:${from}`,
    });
    return;
  }

  if (decided === 'returned') {
    await notificationService.emit({
      ...common,
      type: 'budget.returned',
      audience: ownerAudience(proposal),
      dedupeKey: roundKey(proposal?.id, `returned:${from}`, approvalId),
    });
    return;
  }

  if (decided === 'archived') {
    await notificationService.emit({
      ...common,
      type: 'budget.archived',
      audience: ownerAudience(proposal),
      data: { ...common.data, unarchived: false },
      dedupeKey: roundKey(proposal?.id, 'archived', approvalId),
    });
    return;
  }

  if (decided !== 'approved') return;

  if (to === 'completed' || !to) {
    await notificationService.emit({
      ...common,
      type: 'budget.approved',
      audience: ownerAudience(proposal),
      dedupeKey: `budget:${proposal?.id}:approved`,
    });
    return;
  }

  // Still in flight: the applicant learns it moved on, and the stage it moved
  // to learns it is now theirs.
  await notificationService.emit({
    ...common,
    type: 'budget.stage_advanced',
    audience: [...ownerAudience(proposal), stageAudience(proposal, to)],
    data: { ...common.data, stage: to },
    dedupeKey: roundKey(proposal?.id, `stage:${to}`, approvalId),
  });
}

/** An approver changed the sanctioned amounts without changing the stage. */
export async function notifyBudgetAmountsUpdated({
  proposal,
  actorUserId = null,
  approvalId = null,
  tx,
}) {
  await notificationService.emit({
    type: 'budget.amounts_updated',
    actorUserId,
    subject: subjectOf(proposal),
    audience: ownerAudience(proposal),
    dedupeKey: roundKey(proposal?.id, 'amounts', approvalId),
    tx,
  });
}

/** Archived, or brought back out of the archive. */
export async function notifyBudgetArchiveToggled({
  proposal,
  unarchived = false,
  feedback = null,
  actorUserId = null,
  approvalId = null,
  tx,
}) {
  await notificationService.emit({
    type: 'budget.archived',
    actorUserId,
    subject: subjectOf(proposal),
    audience: ownerAudience(proposal),
    data: { unarchived: Boolean(unarchived), feedback },
    dedupeKey: roundKey(proposal?.id, `archive:${unarchived ? 'off' : 'on'}`, approvalId),
    tx,
  });
}

/** Deleted. Links to the dashboard rather than the record, which is now gone. */
export async function notifyBudgetDeleted({ proposal, actorUserId = null, tx }) {
  await notificationService.emit({
    type: 'budget.deleted',
    actorUserId,
    subject: subjectOf(proposal),
    audience: ownerAudience(proposal),
    dedupeKey: `budget:${proposal?.id}:deleted`,
    tx,
  });
}

export default {
  notifyBudgetSubmitted,
  notifyBudgetResubmitted,
  notifyBudgetDecision,
  notifyBudgetAmountsUpdated,
  notifyBudgetArchiveToggled,
  notifyBudgetDeleted,
};
