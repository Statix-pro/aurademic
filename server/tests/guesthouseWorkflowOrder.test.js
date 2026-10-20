import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn() },
}));

vi.mock('../modules/shared/workflow/workflowScopeResolver.js', () => ({
  assertRecordScopeAccess: vi.fn().mockResolvedValue(undefined),
  resolveQueueScopeFilters: vi.fn(),
  resolveStagePolicy: vi.fn().mockResolvedValue({ scopeType: 'global', meta: null }),
}));

import db from '../config/connection.js';
import { registerWorkflowModule } from '../modules/shared/workflow/workflowModuleRegistry.js';
import { actOnWorkflow, resubmitReturnedWorkflow, startWorkflow } from '../modules/shared/workflow/workflowService.js';

const stages = ['hod', 'guesthouse_incharge', 'principal', 'guesthouse_admin'];
let workflowState;
let adapter;
let transaction;

const actorFor = (stage) => ({
  id: stages.indexOf(stage) + 101,
  userId: stages.indexOf(stage) + 101,
  role: stage,
  roles: [stage],
  permissions: [`guesthouse.workflow.${stage}`],
});

const makeTransaction = () => ({
  beginTransaction: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue(undefined),
  rollback: vi.fn().mockResolvedValue(undefined),
  release: vi.fn(),
  query: vi.fn(async (sql) => {
    if (sql.includes('AS workflow_state')) {
      return [[{ workflow_state: JSON.stringify(workflowState) }]];
    }
    if (sql.includes('FROM workflow_stage_policies')) return [[]];
    if (sql.includes('INSERT INTO workflow_actions')) return [{ affectedRows: 1 }];
    throw new Error(`Unexpected workflow audit query: ${sql}`);
  }),
});

describe('Guest House workflow order and stage permissions', () => {
  beforeEach(() => {
    workflowState = null;
    adapter = {
      resolveStartFlow: () => [...stages],
      getRecordContext: vi.fn().mockResolvedValue({ beneficiaryType: 'Department', applicantUserId: 101 }),
      canApplicantResubmit: vi.fn(({ workflowState }) =>
        workflowState?.status === 'returned' && stages.includes(workflowState?.currentStage),
      ),
      updateRecordWorkflowSnapshot: vi.fn(async (_recordId, nextState) => {
        workflowState = nextState;
      }),
      listRecordsForQueue: vi.fn(),
    };
    registerWorkflowModule({
      moduleKey: 'guesthouse',
      tableName: 'guesthouse_bookings',
      adapter,
    });
    transaction = makeTransaction();
    db.getConnection.mockResolvedValue(transaction);
  });

  it('starts at HOD and advances strictly through all four approved stages', async () => {
    const started = await startWorkflow({ moduleKey: 'guesthouse', recordId: 55 });
    expect(started.state.flow).toEqual(stages);
    expect(started.state.currentStage).toBe('hod');

    for (let index = 0; index < stages.length; index += 1) {
      const currentStage = stages[index];
      const nextStage = stages[index + 1] || null;
      const result = await actOnWorkflow({
        moduleKey: 'guesthouse',
        recordId: 55,
        decision: 'approved',
        actor: actorFor(currentStage),
      });

      expect(result.stage).toBe(currentStage);
      expect(result.currentState.currentStage).toBe(nextStage);
      expect(result.currentState.status).toBe(nextStage ? 'in_progress' : 'completed');
    }

    expect(adapter.updateRecordWorkflowSnapshot).toHaveBeenCalledTimes(5);
    expect(transaction.commit).toHaveBeenCalledTimes(5);
  });

  it.each(stages.flatMap((currentStage) =>
    stages
      .filter((actorStage) => actorStage !== currentStage)
      .map((actorStage) => ({ actorStage, currentStage })),
  ))('denies $actorStage from acting while $currentStage is active', async ({ actorStage, currentStage }) => {
    workflowState = {
      version: 1,
      flow: [...stages],
      currentStage,
      status: 'in_progress',
    };
    const before = structuredClone(workflowState);

    await expect(actOnWorkflow({
      moduleKey: 'guesthouse',
      recordId: 55,
      decision: 'approved',
      actor: actorFor(actorStage),
    })).rejects.toMatchObject({ statusCode: 403, code: 'WORKFLOW_PERMISSION_DENIED' });

    expect(workflowState).toEqual(before);
    expect(adapter.updateRecordWorkflowSnapshot).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalledOnce();
  });

  it('keeps a returned request at the same stage', async () => {
    workflowState = {
      version: 1,
      flow: [...stages],
      currentStage: 'principal',
      status: 'in_progress',
    };

    const returned = await actOnWorkflow({
      moduleKey: 'guesthouse',
      recordId: 55,
      decision: 'returned',
      feedback: 'Please attach the required document.',
      actor: actorFor('principal'),
    });
    expect(returned.currentState).toMatchObject({ currentStage: 'principal', status: 'returned' });
  });

  it.each(stages)('allows the applicant to resubmit a request returned at %s', async (stage) => {
    workflowState = {
      version: 1,
      flow: [...stages],
      currentStage: stage,
      status: 'returned',
      lastFeedback: 'Please correct this request.',
    };

    const result = await resubmitReturnedWorkflow({
      moduleKey: 'guesthouse',
      recordId: 55,
      actor: { id: 101, userId: 101, email: 'applicant@example.edu' },
    });

    expect(result.currentState).toMatchObject({ currentStage: stage, status: 'in_progress' });
    expect(transaction.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES (?, ?, ?, 'resubmitted'"),
      expect.arrayContaining(['guesthouse', 55, stage]),
    );
  });

  it('does not treat generic master-data admin access as a workflow approval permission', async () => {
    workflowState = {
      version: 1,
      flow: [...stages],
      currentStage: 'guesthouse_admin',
      status: 'in_progress',
    };

    await expect(actOnWorkflow({
      moduleKey: 'guesthouse',
      recordId: 55,
      decision: 'approved',
      actor: {
        id: 999,
        userId: 999,
        role: 'admin',
        roles: ['admin'],
        permissions: ['guesthouse.manage'],
      },
    })).rejects.toMatchObject({ statusCode: 403, code: 'WORKFLOW_PERMISSION_DENIED' });

    expect(adapter.updateRecordWorkflowSnapshot).not.toHaveBeenCalled();
  });

  it('makes rejection terminal without advancing to another stage', async () => {
    workflowState = {
      version: 1,
      flow: [...stages],
      currentStage: 'guesthouse_incharge',
      status: 'in_progress',
    };

    const result = await actOnWorkflow({
      moduleKey: 'guesthouse',
      recordId: 55,
      decision: 'rejected',
      feedback: 'Request cannot be approved.',
      actor: actorFor('guesthouse_incharge'),
    });

    expect(result.currentState).toMatchObject({ currentStage: null, status: 'rejected' });
  });
});
