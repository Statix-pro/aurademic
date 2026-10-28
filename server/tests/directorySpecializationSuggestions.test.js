import { beforeEach, describe, expect, it, vi } from 'vitest';

const connection = {
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  execute: vi.fn(),
  query: vi.fn(),
};

vi.mock('../config/connection.js', () => ({
  default: {
    getConnection: vi.fn(async () => connection),
    execute: vi.fn(),
    query: vi.fn(),
  },
}));
vi.mock('../modules/shared/workflow/workflowService.js', () => ({
  default: { startWorkflow: vi.fn(), logWorkflowResubmission: vi.fn(), actOnWorkflow: vi.fn() },
}));

const db = (await import('../config/connection.js')).default;
const workflowService = (await import('../modules/shared/workflow/workflowService.js')).default;
const { reviewOption, suggestSpecialization, updateOption, createDirectoryLists } =
  await import('../modules/shared/directoryLists.js');
const organizationModel = (
  await import('../modules/organizationDirectory/organizationDirectoryModel.js')
).default;
const resourcePersonModel = (
  await import('../modules/resourcepersonDirectory/resourcepersonDirectoryModel.js')
).default;

const entry = (overrides = {}) => ({
  id: 9,
  list_key: 'specialization',
  name: 'Robotics',
  is_active: 1,
  approval_status: 'Pending',
  suggested_by: 4,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  connection.execute.mockReset();
  connection.query.mockReset();
  db.execute.mockReset();
  db.query.mockReset();
});

// A directory user adds a Specialization from the form; it must wait for the Directory Admin
// and must never duplicate, revive or take over an entry the admin already decided on.
describe('suggestSpecialization', () => {
  it('adds a new name as Pending, suggested by the user', async () => {
    connection.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 9 }])
      .mockResolvedValueOnce([[entry()]]);

    const result = await suggestSpecialization({ name: '  Robotics ' }, 4);

    expect(result).toMatchObject({ created: true, entry: { id: 9, approval_status: 'Pending' } });
    const [insertSql, insertParams] = connection.execute.mock.calls[1];
    expect(insertSql).toMatch(/'Pending'/);
    expect(insertParams).toEqual(['Robotics', 4]);
    expect(connection.commit).toHaveBeenCalled();
  });

  it.each([
    ['an approved, active entry', entry({ approval_status: 'Approved', suggested_by: null })],
    ['the user’s own pending suggestion', entry()],
  ])('returns %s instead of adding it twice', async (_label, listed) => {
    connection.execute.mockResolvedValueOnce([[listed]]).mockResolvedValueOnce([[listed]]);

    const result = await suggestSpecialization({ name: 'robotics' }, 4);

    expect(result.created).toBe(false);
    expect(result.entry.name).toBe('Robotics');
    expect(connection.execute.mock.calls.some(([sql]) => /^\s*INSERT/.test(sql))).toBe(false);
  });

  it.each([
    [
      'another user’s pending suggestion',
      entry({ suggested_by: 7 }),
      /waiting for the Directory Admin/,
    ],
    ['a rejected suggestion', entry({ approval_status: 'Rejected' }), /not approved/],
    [
      'a retired entry',
      entry({ approval_status: 'Approved', is_active: 0, suggested_by: null }),
      /retired/,
    ],
  ])('refuses %s', async (_label, listed, message) => {
    connection.execute.mockResolvedValueOnce([[listed]]);

    await expect(suggestSpecialization({ name: 'Robotics' }, 4)).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(message),
    });
    expect(connection.rollback).toHaveBeenCalled();
  });

  it('refuses an empty name', async () => {
    await expect(suggestSpecialization({ name: '  ' }, 4)).rejects.toMatchObject({ status: 400 });
  });
});

describe('reviewOption', () => {
  it('decides only a Pending suggestion', async () => {
    db.execute
      .mockResolvedValueOnce([{ affectedRows: 0 }])
      .mockResolvedValueOnce([[entry({ approval_status: 'Approved' })]]);

    await expect(reviewOption(9, 'reject', 1)).rejects.toMatchObject({
      status: 409,
      message: 'This suggestion was already approved.',
    });
    expect(db.execute.mock.calls[0][0]).toMatch(/approval_status = 'Pending'/);
  });

  it('refuses a decision other than approve or reject', async () => {
    await expect(reviewOption(9, 'maybe', 1)).rejects.toMatchObject({ status: 400 });
    expect(db.execute).not.toHaveBeenCalled();
  });
});

// Records hold a specialization by name; renaming a suggestion would strand the records that
// picked it outside the review.
it('refuses to edit a suggestion before it is reviewed', async () => {
  db.execute.mockResolvedValueOnce([
    [{ list_key: 'specialization', name: 'Robotics', approval_status: 'Pending' }],
  ]);

  await expect(updateOption(9, { name: 'Robotics Eng' })).rejects.toMatchObject({ status: 409 });
  expect(db.execute).toHaveBeenCalledTimes(1);
});

// The saver may use their own suggestion straight away; the list query must be asked for it.
it('offers the saver’s own Pending suggestions when validating a record', async () => {
  const lists = createDirectoryLists({ picks: 'picks', recordColumn: 'record_id' });
  connection.execute.mockResolvedValueOnce([
    [
      { list_key: 'tag', name: 'General' },
      { list_key: 'specialization', name: 'Robotics' },
    ],
  ]);

  const listed = await lists.toListedValues(
    connection,
    { tag: 'General', specializations: ['robotics'] },
    {},
    { userId: 4 },
  );

  expect(listed.specializations).toEqual(['Robotics']);
  const [sql, params] = connection.execute.mock.calls[0];
  expect(sql).toMatch(/approval_status = 'Pending'[\s\S]*suggested_by = \?/);
  expect(params).toEqual([4]);
});

// A record that picked a suggestion is approved only after the suggestion is: Pending waits
// for the admin, Rejected waits for the owner to remove it. Both directories, and nothing is
// approved when refused.
describe('approval holds', () => {
  const holdRow = (status) => ({ record_id: 3, name: 'Robotics', approval_status: status });

  it.each([
    ['Pending', /Approve the specialization "Robotics"/],
    ['Rejected', /"Robotics" was rejected/],
  ])('refuses to approve an organization holding a %s suggestion', async (status, message) => {
    db.execute.mockResolvedValueOnce([[]]); // no approved duplicate
    connection.execute.mockResolvedValueOnce([[{ id: 3 }]]); // row lock
    connection.query.mockResolvedValueOnce([[holdRow(status)]]);

    await expect(organizationModel.review(3, 'approve', { userId: 1 })).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(message),
    });
    expect(connection.query.mock.calls[0][0]).toMatch(/FOR SHARE/);
    expect(workflowService.actOnWorkflow).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalled();
  });

  it('approves an organization once its suggestions are approved', async () => {
    db.execute.mockResolvedValueOnce([[]]);
    connection.execute.mockResolvedValueOnce([[{ id: 3 }]]);
    connection.query.mockResolvedValueOnce([[]]);

    await expect(organizationModel.review(3, 'approve', { userId: 1 })).resolves.toEqual({
      id: 3,
      status: 'Approved',
    });
    expect(workflowService.actOnWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'approved', tx: connection }),
    );
  });

  it('refuses to approve a person holding a Pending suggestion', async () => {
    connection.execute.mockResolvedValueOnce([[{ id: 3 }]]); // row lock
    connection.query
      .mockResolvedValueOnce([[]]) // no organization holds
      .mockResolvedValueOnce([[holdRow('Pending')]]);

    await expect(resourcePersonModel.review(3, 'approve', { userId: 1 })).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/still pending/),
    });
    expect(workflowService.actOnWorkflow).not.toHaveBeenCalled();
  });

  it('still lets a held record be rejected', async () => {
    db.execute.mockResolvedValueOnce([[]]);

    await expect(organizationModel.review(3, 'reject', { userId: 1 })).resolves.toEqual({
      id: 3,
      status: 'Rejected',
    });
    expect(connection.query).not.toHaveBeenCalled();
  });
});
