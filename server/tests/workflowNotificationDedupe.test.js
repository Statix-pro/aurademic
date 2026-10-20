/**
 * A record does not travel through a workflow once. It advances, gets returned,
 * gets resubmitted, advances through the same stages again; a finance record
 * that is already approved gets topped up and approved a second time.
 *
 * `notification_events.dedupe_key` is UNIQUE, so a key that names only the
 * record and the stage suppresses every one of those later passes: the second
 * time a request reaches the DoF queue, nobody in it is told. These tests pin
 * the key to the `workflow_actions` row that caused the transition, which is
 * the thing that is genuinely once-per-transition.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({
  default: { query: vi.fn(), getConnection: vi.fn() },
}));

vi.mock('../modules/shared/workflow/workflowModuleRegistry.js', () => ({
  getWorkflowModule: vi.fn(),
  registerWorkflowModule: vi.fn(),
  listRegisteredWorkflowModules: vi.fn(() => []),
}));

vi.mock('../modules/shared/workflow/workflowScopeResolver.js', () => ({
  assertRecordScopeAccess: vi.fn(),
  resolveQueueScopeFilters: vi.fn(),
  resolveStagePolicy: vi.fn(),
  STAGE_ROLE_CODES: {},
}));

vi.mock('../modules/notification/notificationService.js', () => ({
  default: { emit: vi.fn() },
}));

import db from '../config/connection.js';
import notificationService from '../modules/notification/notificationService.js';
import { getWorkflowModule } from '../modules/shared/workflow/workflowModuleRegistry.js';
import { resolveStagePolicy } from '../modules/shared/workflow/workflowScopeResolver.js';
import {
  actOnWorkflow,
  logWorkflowResubmission,
} from '../modules/shared/workflow/workflowService.js';

const FLOW = ['level1', 'dof', 'principal'];

const stateAt = (currentStage, overrides = {}) => ({
  version: 1,
  flow: [...FLOW],
  currentStage,
  status: 'in_progress',
  isEditableByApplicant: false,
  startedAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  resolvedAt: null,
  lastDecision: null,
  lastFeedback: null,
  ...overrides,
});

const actor = { userId: 7, email: 'approver@example.com', role: 'dof', isSuperAdmin: true };

/** The next `workflow_actions` insert id, so each transition gets a distinct one. */
let nextActionId = 0;
let adapter;
let conn;

/**
 * One fake connection standing in for the whole transaction. The SELECT that
 * loads the workflow state is answered from `currentState`; the INSERT into
 * workflow_actions answers with a fresh insertId, which is the value under test.
 */
const makeConn = (currentState) => ({
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  query: vi.fn(async (sql) => {
    if (/INSERT INTO workflow_actions/i.test(sql)) {
      nextActionId += 1;
      return [{ insertId: nextActionId }];
    }
    if (/workflow_state/i.test(sql)) {
      return [[{ workflow_state: JSON.stringify(currentState) }]];
    }
    return [[]];
  }),
});

const act = async (currentState, decision, feedback = null) => {
  conn = makeConn(currentState);
  db.getConnection.mockResolvedValue(conn);
  return actOnWorkflow({ moduleKey: 'finance', recordId: 42, decision, feedback, actor });
};

const dedupeKeyOf = (call) => call[0].dedupeKey;

beforeEach(() => {
  vi.clearAllMocks();
  nextActionId = 0;

  adapter = {
    getRecordContext: vi.fn().mockResolvedValue({
      applicantUserId: 3,
      departmentId: 11,
      totalBudget: 5000,
    }),
    updateRecordWorkflowSnapshot: vi.fn(),
  };

  getWorkflowModule.mockReturnValue({
    moduleKey: 'finance',
    tableName: 'finance_requests',
    idColumn: 'id',
    stateColumn: 'workflow_state',
    adapter,
  });

  resolveStagePolicy.mockResolvedValue({ scopeType: 'department', meta: null });
  notificationService.emit.mockResolvedValue(1);
});

describe('stage_advanced notifications across a return/resubmit cycle', () => {
  it('gives the second arrival at a stage its own dedupe key', async () => {
    // Pass one: level1 approves, the request lands in the DoF queue.
    await act(stateAt('level1'), 'approved');
    // Returned to the applicant, resubmitted, and approved at level1 again —
    // the request arrives in the DoF queue for a second time.
    await act(stateAt('dof'), 'returned', 'Missing quotation');
    await act(stateAt('level1', { status: 'returned' }), 'approved');

    const advances = notificationService.emit.mock.calls.filter(
      (call) => call[0].type === 'finance.stage_advanced',
    );

    expect(advances).toHaveLength(2);
    // Both announce the same stage. If they shared a key the second INSERT
    // would be rejected as a duplicate and the DoF approvers would never hear.
    expect(advances[0][0].data.stage).toBe('dof');
    expect(advances[1][0].data.stage).toBe('dof');
    expect(dedupeKeyOf(advances[0])).not.toBe(dedupeKeyOf(advances[1]));
  });

  it('keys the advance on the workflow_actions row that caused it', async () => {
    await act(stateAt('level1'), 'approved');

    const [call] = notificationService.emit.mock.calls;
    expect(dedupeKeyOf(call)).toBe('finance:42:stage:dof:1');
  });

  it('omits the key entirely rather than guessing when the action id is lost', async () => {
    // A null dedupe key means "no deduplication", which is the safe direction:
    // a possible duplicate notification beats a silently dropped one.
    conn = {
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      release: vi.fn(),
      query: vi.fn(async (sql) => {
        if (/INSERT INTO workflow_actions/i.test(sql)) return [{}];
        if (/workflow_state/i.test(sql)) {
          return [[{ workflow_state: JSON.stringify(stateAt('level1')) }]];
        }
        return [[]];
      }),
    };
    db.getConnection.mockResolvedValue(conn);

    await actOnWorkflow({ moduleKey: 'finance', recordId: 42, decision: 'approved', actor });

    expect(dedupeKeyOf(notificationService.emit.mock.calls[0])).toBeNull();
  });
});

describe('approved notifications on a re-approved record', () => {
  it('gives a top-up approval its own dedupe key', async () => {
    // A top-up can only be raised against a record that is already approved, so
    // the final approval genuinely happens more than once per record.
    await act(stateAt('principal'), 'approved');
    await act(stateAt('principal'), 'approved');

    const approvals = notificationService.emit.mock.calls.filter(
      (call) => call[0].type === 'finance.approved',
    );

    expect(approvals).toHaveLength(2);
    expect(dedupeKeyOf(approvals[0])).not.toBe(dedupeKeyOf(approvals[1]));
  });
});

describe('returned notifications', () => {
  it('keys each return on its own action rather than on the clock', async () => {
    await act(stateAt('dof'), 'returned', 'Missing quotation');
    await act(stateAt('dof'), 'returned', 'Still missing');

    const returns = notificationService.emit.mock.calls.filter(
      (call) => call[0].type === 'finance.returned',
    );

    expect(returns.map(dedupeKeyOf)).toEqual([
      'finance:42:returned:dof:1',
      'finance:42:returned:dof:2',
    ]);
  });
});

describe('logWorkflowResubmission', () => {
  it('keys each resubmission on the action row it just wrote', async () => {
    const tx = {
      query: vi.fn(async (sql) => {
        if (/INSERT INTO workflow_actions/i.test(sql)) {
          nextActionId += 1;
          return [{ insertId: nextActionId }];
        }
        return [[]];
      }),
    };

    await logWorkflowResubmission({ moduleKey: 'finance', recordId: 42, stage: 'level1', tx });
    await logWorkflowResubmission({ moduleKey: 'finance', recordId: 42, stage: 'level1', tx });

    expect(notificationService.emit.mock.calls.map(dedupeKeyOf)).toEqual([
      'finance:42:resubmitted:level1:1',
      'finance:42:resubmitted:level1:2',
    ]);
  });
});
