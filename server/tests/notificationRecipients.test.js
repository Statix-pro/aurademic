/**
 * Recipient resolution is the one genuinely new piece of logic in the
 * notification system, and the easiest to get subtly wrong.
 *
 * Approval in this portal is pull-based: there is no assignee column, so the
 * set of people who may act on a record is derived from role + org-unit scope
 * every time. `resolveStageRecipients` inverts the forward authorization check
 * (`may THIS actor act?`) into an audience (`who may act?`). If the two ever
 * disagree, the portal either notifies people who cannot act, or — far worse —
 * stays silent for the person the request is waiting on.
 *
 * These tests pin the inversion against each scope type and against the
 * fallback rule that is easiest to get wrong: the HOD-of-another-department
 * case in "does not fall back for a user assigned elsewhere".
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({
  default: { query: vi.fn(), getConnection: vi.fn() },
}));

import { resolveRecipients } from '../modules/notification/recipientResolver.js';
import { resolveStageRecipients } from '../modules/shared/workflow/workflowScopeResolver.js';

/**
 * A fake connection that answers by matching the SQL it is handed. Real SQL
 * against a real schema is covered by the manual end-to-end pass; what matters
 * here is the branching between those queries.
 */
const makeConn = (handlers) => ({
  query: vi.fn(async (sql, params) => {
    for (const [needle, rows] of handlers) {
      if (sql.includes(needle)) {
        return [typeof rows === 'function' ? rows(params) : rows, []];
      }
    }
    return [[], []];
  }),
});

const STAGE_POLICY_SQL = 'FROM workflow_stage_policies';
const BY_ROLE_SQL = 'JOIN roles r ON r.id = combined.role_id';
const BY_PERMISSION_SQL = 'JOIN role_permissions rp ON rp.role_id = combined.role_id';
const ASSIGNED_SQL = 'FROM user_entity_roles uer';
const EMPLOYEE_SQL = 'FROM master_employees';

describe('resolveStageRecipients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns every role holder for a global stage', async () => {
    // dof and principal are global: the record's department is irrelevant.
    const conn = makeConn([
      [
        STAGE_POLICY_SQL,
        [{ module_key: 'finance', stage_key: 'dof', scope_type: 'global', meta: null }],
      ],
      [BY_ROLE_SQL, [{ user_id: 11 }, { user_id: 12 }]],
      [BY_PERMISSION_SQL, [{ user_id: 12 }, { user_id: 13 }]],
    ]);

    const recipients = await resolveStageRecipients({
      conn,
      moduleKey: 'finance',
      stageKey: 'dof',
      recordContext: { departmentId: 5 },
    });

    // Role holders and permission holders are unioned, not intersected.
    expect(recipients.sort()).toEqual([11, 12, 13]);
  });

  it('defaults to global scope when the stage has no policy row', async () => {
    const conn = makeConn([
      [STAGE_POLICY_SQL, []],
      [BY_ROLE_SQL, [{ user_id: 21 }]],
    ]);

    const recipients = await resolveStageRecipients({
      conn,
      moduleKey: 'finance',
      stageKey: 'principal',
      recordContext: { departmentId: 5 },
    });

    expect(recipients).toEqual([21]);
  });

  it('narrows a department stage to people assigned to that department', async () => {
    const conn = makeConn([
      [
        STAGE_POLICY_SQL,
        [
          {
            module_key: 'finance',
            stage_key: 'level1',
            scope_type: 'department',
            meta: { requireAssignment: true, assignmentRoleCodes: ['hod'] },
          },
        ],
      ],
      // Three people hold the level1 roles somewhere in the institution...
      [BY_ROLE_SQL, [{ user_id: 31 }, { user_id: 32 }, { user_id: 33 }]],
      // ...but only two are assigned to department 5.
      [ASSIGNED_SQL, [{ user_id: 31 }, { user_id: 32 }]],
    ]);

    const recipients = await resolveStageRecipients({
      conn,
      moduleKey: 'finance',
      stageKey: 'level1',
      recordContext: { departmentId: 5, beneficiaryType: 'department' },
    });

    expect(recipients.sort()).toEqual([31, 32]);
  });

  it('falls back to the primary employee record when assignment is not required', async () => {
    // Mirrors loadPrimaryEmployeeContext in the forward path: a user with no
    // explicit assignment is treated as belonging to their employee department.
    const conn = makeConn([
      [
        STAGE_POLICY_SQL,
        [
          {
            module_key: 'finance',
            stage_key: 'level1',
            scope_type: 'department',
            meta: { requireAssignment: false, assignmentRoleCodes: ['hod'] },
          },
        ],
      ],
      [BY_ROLE_SQL, [{ user_id: 41 }]],
      [
        ASSIGNED_SQL,
        (params) =>
          // The scoped query passes the department id; the "assigned anywhere"
          // query does not. Nobody is explicitly assigned in this scenario.
          params[0] === 5 ? [] : [],
      ],
      [EMPLOYEE_SQL, [{ user_id: 41 }]],
    ]);

    const recipients = await resolveStageRecipients({
      conn,
      moduleKey: 'finance',
      stageKey: 'level1',
      recordContext: { departmentId: 5, beneficiaryType: 'department' },
    });

    expect(recipients).toEqual([41]);
  });

  it('asks only for the primary employee row, as the forward path does', async () => {
    // `loadPrimaryEmployeeContext` — the forward path, and therefore what
    // `assertRecordScopeAccess` enforces — reads one row per user, the
    // lowest-id active one. Matching any active row here would invite a user
    // with employee rows in two departments to open a record the forward check
    // then refuses, so the SQL has to pin the same single row. Asserted against
    // the query text because the narrowing lives in SQL, not in JavaScript.
    const conn = makeConn([
      [
        STAGE_POLICY_SQL,
        [
          {
            module_key: 'finance',
            stage_key: 'level1',
            scope_type: 'department',
            meta: { requireAssignment: false, assignmentRoleCodes: ['hod'] },
          },
        ],
      ],
      [BY_ROLE_SQL, [{ user_id: 41 }]],
      [ASSIGNED_SQL, []],
      [EMPLOYEE_SQL, [{ user_id: 41 }]],
    ]);

    await resolveStageRecipients({
      conn,
      moduleKey: 'finance',
      stageKey: 'level1',
      recordContext: { departmentId: 5, beneficiaryType: 'department' },
    });

    const employeeQuery = conn.query.mock.calls.find(
      ([sql]) => sql.includes(EMPLOYEE_SQL) && sql.includes('department_id'),
    );

    expect(employeeQuery).toBeDefined();
    expect(employeeQuery[0]).toMatch(/MIN\(id\)\s+AS\s+primary_id/i);
    expect(employeeQuery[0]).toMatch(/GROUP BY user_id/i);
  });

  it('does not fall back for a user assigned elsewhere', async () => {
    // The case that makes this inversion tricky. User 51 is the HOD of
    // department 9 by explicit assignment, but their employee row still says
    // department 5. Notifying them about department 5 would leak another
    // department's requests into their bell — and the forward check would then
    // refuse the approval they were invited to make.
    const conn = makeConn([
      [
        STAGE_POLICY_SQL,
        [
          {
            module_key: 'finance',
            stage_key: 'level1',
            scope_type: 'department',
            meta: { requireAssignment: false, assignmentRoleCodes: ['hod'] },
          },
        ],
      ],
      [BY_ROLE_SQL, [{ user_id: 51 }]],
      [
        ASSIGNED_SQL,
        (params) =>
          // Scoped query (department 5) finds nobody; the unscoped
          // "assigned anywhere" query finds user 51 assigned to department 9.
          params.length && params[0] === 5 ? [] : [{ user_id: 51 }],
      ],
      [EMPLOYEE_SQL, [{ user_id: 51 }]],
    ]);

    const recipients = await resolveStageRecipients({
      conn,
      moduleKey: 'finance',
      stageKey: 'level1',
      recordContext: { departmentId: 5, beneficiaryType: 'department' },
    });

    expect(recipients).toEqual([]);
  });

  it('narrows an entity stage to that entity', async () => {
    const conn = makeConn([
      [
        STAGE_POLICY_SQL,
        [
          {
            module_key: 'finance',
            stage_key: 'level1',
            scope_type: 'entity',
            meta: { requireAssignment: true, assignmentRoleCodes: ['coordinator'] },
          },
        ],
      ],
      [BY_ROLE_SQL, [{ user_id: 61 }, { user_id: 62 }]],
      [ASSIGNED_SQL, [{ user_id: 62 }]],
    ]);

    const recipients = await resolveStageRecipients({
      conn,
      moduleKey: 'finance',
      stageKey: 'level1',
      recordContext: { beneficiaryEntityId: 77, beneficiaryType: 'cell' },
    });

    expect(recipients).toEqual([62]);
  });

  it('stays silent rather than throwing when a scoped record has no org unit', async () => {
    // The forward path raises SCOPE_CONTEXT_MISSING here, which is right for an
    // authorization check. For notifications there is simply no audience.
    const conn = makeConn([
      [
        STAGE_POLICY_SQL,
        [
          {
            module_key: 'finance',
            stage_key: 'level1',
            scope_type: 'department',
            meta: { requireAssignment: false, assignmentRoleCodes: ['hod'] },
          },
        ],
      ],
      [BY_ROLE_SQL, [{ user_id: 71 }]],
    ]);

    const recipients = await resolveStageRecipients({
      conn,
      moduleKey: 'finance',
      stageKey: 'level1',
      recordContext: { departmentId: null, beneficiaryEntityId: null },
    });

    expect(recipients).toEqual([]);
  });

  it('accepts finance.workflow.* permissions for an expenditure stage', async () => {
    // assertDecisionPermission accepts both for expenditure, so the audience
    // must too, or a user who can approve would never be told to.
    const conn = makeConn([
      [
        STAGE_POLICY_SQL,
        [{ module_key: 'expenditure', stage_key: 'dof', scope_type: 'global', meta: null }],
      ],
      [BY_ROLE_SQL, []],
      [
        BY_PERMISSION_SQL,
        (params) => (params[0].includes('finance.workflow.dof') ? [{ user_id: 81 }] : []),
      ],
    ]);

    const recipients = await resolveStageRecipients({
      conn,
      moduleKey: 'expenditure',
      stageKey: 'dof',
      recordContext: {},
    });

    expect(recipients).toEqual([81]);
  });

  it('does not treat chairman as a role-bearing stage outside finance', async () => {
    // canAccessStageByRole restricts chairman to finance; holding the role must
    // not make someone an expenditure recipient.
    const conn = makeConn([
      [
        STAGE_POLICY_SQL,
        [{ module_key: 'expenditure', stage_key: 'chairman', scope_type: 'global', meta: null }],
      ],
      [BY_ROLE_SQL, [{ user_id: 91 }]],
      [BY_PERMISSION_SQL, []],
    ]);

    const recipients = await resolveStageRecipients({
      conn,
      moduleKey: 'expenditure',
      stageKey: 'chairman',
      recordContext: {},
    });

    // The role query is never asked for chairman roles, so nobody matches.
    expect(recipients).toEqual([]);
  });

  it('resolves anyway when a promoted scope makes the policy meta invalid', async () => {
    // finance/level1 is promoted from the configured scope to department scope
    // based on the record, and the stricter scope demands meta this row does
    // not carry. The forward path is right to raise; here that would retry the
    // event until it gave up, so it degrades to requiring an explicit
    // assignment instead.
    const conn = makeConn([
      [
        STAGE_POLICY_SQL,
        [{ module_key: 'finance', stage_key: 'level1', scope_type: 'global', meta: null }],
      ],
      [BY_ROLE_SQL, [{ user_id: 101 }, { user_id: 102 }]],
      [ASSIGNED_SQL, [{ user_id: 102 }]],
    ]);

    const recipients = await resolveStageRecipients({
      conn,
      moduleKey: 'finance',
      stageKey: 'level1',
      recordContext: { departmentId: 5, beneficiaryType: 'department' },
    });

    expect(recipients).toEqual([102]);
  });

  it('returns nothing for an empty stage key rather than querying', async () => {
    const conn = makeConn([]);
    expect(await resolveStageRecipients({ conn, moduleKey: 'finance', stageKey: '' })).toEqual([]);
    expect(conn.query).not.toHaveBeenCalled();
  });
});

describe('resolveRecipients', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves direct user descriptors without touching the database', async () => {
    const conn = makeConn([]);
    const { recipients } = await resolveRecipients({
      conn,
      audience: [{ kind: 'user', userId: 7, recipientRole: 'applicant' }],
    });

    expect(recipients).toEqual([{ userId: 7, recipientRole: 'applicant' }]);
    expect(conn.query).not.toHaveBeenCalled();
  });

  it('never notifies the actor about their own action', async () => {
    const conn = makeConn([]);
    const { recipients } = await resolveRecipients({
      conn,
      actorUserId: 7,
      audience: [{ kind: 'users', userIds: [7, 8], recipientRole: 'approver' }],
    });

    expect(recipients).toEqual([{ userId: 8, recipientRole: 'approver' }]);
  });

  it('gives a user matched twice the more personal role', async () => {
    // An HOD who submitted their own department's request is both applicant and
    // approver. They should read it as "your request", not "approve this".
    const conn = makeConn([]);
    const { recipients } = await resolveRecipients({
      conn,
      audience: [
        { kind: 'user', userId: 5, recipientRole: 'approver' },
        { kind: 'user', userId: 5, recipientRole: 'applicant' },
      ],
    });

    expect(recipients).toEqual([{ userId: 5, recipientRole: 'applicant' }]);
  });

  it('deduplicates a user reached through several descriptors', async () => {
    const conn = makeConn([[BY_ROLE_SQL, [{ user_id: 9 }]]]);
    const { recipients } = await resolveRecipients({
      conn,
      audience: [
        { kind: 'user', userId: 9, recipientRole: 'approver' },
        { kind: 'role', roleCodes: ['dof'], recipientRole: 'approver' },
      ],
    });

    expect(recipients).toHaveLength(1);
  });

  it('keeps going when one descriptor fails, and reports it', async () => {
    // Telling four of five people beats telling nobody because one lookup broke.
    const conn = {
      query: vi.fn(async (sql) => {
        if (sql.includes(BY_ROLE_SQL)) throw new Error('table is gone');
        return [[], []];
      }),
    };

    const { recipients, errors } = await resolveRecipients({
      conn,
      audience: [
        { kind: 'user', userId: 3, recipientRole: 'applicant' },
        { kind: 'role', roleCodes: ['dof'], recipientRole: 'approver' },
      ],
    });

    expect(recipients).toEqual([{ userId: 3, recipientRole: 'applicant' }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('table is gone');
  });

  it('expands a trailing-* permission into a prefix match', async () => {
    const conn = makeConn([[BY_PERMISSION_SQL, [{ user_id: 4 }]]]);
    await resolveRecipients({
      conn,
      audience: [
        { kind: 'permission', permissions: ['finance.workflow.*'], recipientRole: 'approver' },
      ],
    });

    const [, params] = conn.query.mock.calls[0];
    expect(params).toContain('finance.workflow.%');
  });

  it('ignores a bare "*" permission rather than notifying everyone', async () => {
    const conn = makeConn([[BY_PERMISSION_SQL, [{ user_id: 4 }]]]);
    const { recipients } = await resolveRecipients({
      conn,
      audience: [{ kind: 'permission', permissions: ['*'], recipientRole: 'approver' }],
    });

    expect(recipients).toEqual([]);
    expect(conn.query).not.toHaveBeenCalled();
  });

  it('escapes LIKE metacharacters in a permission prefix', async () => {
    const conn = makeConn([[BY_PERMISSION_SQL, []]]);
    await resolveRecipients({
      conn,
      audience: [{ kind: 'permission', permissions: ['a_b%c.*'], recipientRole: 'approver' }],
    });

    const [, params] = conn.query.mock.calls[0];
    expect(params).toContain('a\\_b\\%c.%');
  });

  it('ignores an unknown descriptor kind instead of throwing', async () => {
    const conn = makeConn([]);
    const { recipients } = await resolveRecipients({
      conn,
      audience: [{ kind: 'telepathy', recipientRole: 'approver' }],
    });

    expect(recipients).toEqual([]);
  });

  it('maps employee ids to their login users', async () => {
    const conn = makeConn([[EMPLOYEE_SQL, [{ user_id: 12 }]]]);
    const { recipients } = await resolveRecipients({
      conn,
      audience: [{ kind: 'employee', employeeId: 300, recipientRole: 'applicant' }],
    });

    expect(recipients).toEqual([{ userId: 12, recipientRole: 'applicant' }]);
  });
});
