import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
// Tag/Specialization list lookups and specialization rows are answered here by their SQL,
// so the tests below keep queueing results for the statements they are about.
// `activeOptions` is what the lists currently offer.
const activeOptions = [];
// A record's stored specializations, as the update reads them.
const storedSpecializations = [];
// The organization links a record's profession rows hold, as the update reads them.
const storedOrganizationLinks = [];
const specializationRows = vi.fn();
const answerListQuery = (sql, params) => {
  if (/^\s*SELECT organization_id FROM directory_resource_person_professions/.test(sql))
    return [storedOrganizationLinks];
  if (/FROM directory_(resource_person|organization)_options WHERE is_active = 1/.test(sql))
    return [activeOptions];
  if (/directory_(resource_person|organization)_specializations/.test(sql)) {
    specializationRows(sql, params);
    if (/^\s*SELECT name FROM/.test(sql)) return [storedSpecializations];
    return /^\s*SELECT/.test(sql) ? [[]] : [{}];
  }
  return undefined;
};
const connection = {
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  execute: async (sql, params) => answerListQuery(sql, params) ?? execute(sql, params),
  query: async (sql, params) => answerListQuery(sql, params) ?? execute(sql, params),
};

vi.mock('../config/connection.js', () => ({
  default: {
    getConnection: vi.fn(async () => connection),
    // Once a test's queued results run out, a specializations load still gets its rows.
    query: vi.fn(async (sql, params) => answerListQuery(sql, params) ?? [[]]),
    execute: vi.fn(),
  },
}));
vi.mock('../modules/shared/workflow/workflowService.js', () => ({
  default: {
    startWorkflow: vi.fn(),
    logWorkflowResubmission: vi.fn(),
    actOnWorkflow: vi.fn(),
  },
}));
vi.mock('../modules/shared/uploadPaths.js', () => ({
  deleteUploadedFile: vi.fn(),
}));

import db from '../config/connection.js';
import organizationModel from '../modules/organizationDirectory/organizationDirectoryModel.js';
import resourcePersonModel from '../modules/resourcepersonDirectory/resourcepersonDirectoryModel.js';
import { deleteUploadedFile } from '../modules/shared/uploadPaths.js';
import workflowService from '../modules/shared/workflow/workflowService.js';

describe('directory owner-only edits', () => {
  beforeEach(() => {
    execute.mockReset();
    connection.beginTransaction.mockReset();
    connection.commit.mockReset();
    connection.rollback.mockReset();
    connection.release.mockReset();
    db.query.mockReset();
    db.execute.mockReset();
    workflowService.actOnWorkflow.mockReset();
    db.getConnection.mockClear();
    workflowService.startWorkflow.mockReset();
    workflowService.logWorkflowResubmission.mockReset();
    deleteUploadedFile.mockReset();
  });

  it('allows an organization owner to edit their record', async () => {
    execute
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ id: 10, name: 'Updated', category: 'Academic', tag: 'General' }]]);

    await expect(organizationModel.update(10, { name: 'Updated' }, 2)).resolves.toBeTruthy();
    expect(execute.mock.calls[0][1]).toEqual([10, 2]);
    expect(execute.mock.calls[1][0]).toMatch(/is_active = 0, updated_by = NULL/);
    expect(workflowService.logWorkflowResubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleKey: 'organization_directory',
        recordId: 10,
        actor: { userId: 2 },
        tx: connection,
      }),
    );
  });

  it('refuses a non-owner edit of an approved organization without changing it', async () => {
    execute.mockResolvedValueOnce([[]]);
    await expect(organizationModel.update(10, { name: 'Updated' }, 3)).rejects.toThrow(
      'Organization not found',
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toMatch(/^SELECT id, tag FROM organizations/);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
  });

  it('allows a resource-person owner to edit their record', async () => {
    execute
      .mockResolvedValueOnce([[{ id: 11, created_at: null }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    await expect(
      resourcePersonModel.update(
        11,
        {
          firstName: 'A',
          lastName: 'B',
          professions: '[]',
        },
        {},
        2,
      ),
    ).resolves.toBeTruthy();
    expect(execute.mock.calls[0][1]).toEqual([11, 2]);
    expect(execute.mock.calls[1][0]).toMatch(/is_active = \?, updated_by = \?/);
    expect(execute.mock.calls[1][0]).not.toMatch(
      /photo_(name|path|mime_type|file_size)|resume_(name|path|mime_type|file_size)/,
    );
    expect(workflowService.logWorkflowResubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleKey: 'resource_person_directory',
        recordId: 11,
        actor: { userId: 2 },
        tx: connection,
      }),
    );
  });

  it('rejects a resource-person edit by another user', async () => {
    execute.mockResolvedValueOnce([[]]);
    await expect(
      resourcePersonModel.update(
        11,
        {
          firstName: 'A',
          lastName: 'B',
          professions: '[]',
        },
        {},
        3,
      ),
    ).rejects.toThrow('Resource person not found');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0]).toMatch(/^SELECT \* FROM directory_resource_persons/);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
  });

  it('updates resource-person file columns only when replacements were uploaded', async () => {
    execute
      .mockResolvedValueOnce([[{ id: 11, created_at: null }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    await resourcePersonModel.update(
      11,
      {
        firstName: 'A',
        lastName: 'B',
        professions: '[]',
      },
      {
        photoFile: [
          { filename: 'photo.jpg', mimetype: 'image/jpeg', originalname: 'photo.jpg', size: 10 },
        ],
        resumeFile: [
          {
            filename: 'resume.pdf',
            mimetype: 'application/pdf',
            originalname: 'resume.pdf',
            size: 20,
          },
        ],
      },
      2,
    );

    expect(execute.mock.calls[1][0]).toMatch(/photo_name = \?, photo_path = \?/);
    expect(execute.mock.calls[1][0]).toMatch(/resume_name = \?, resume_path = \?/);
  });

  it('deletes replaced resource-person files only after the update commits', async () => {
    execute
      .mockResolvedValueOnce([
        [
          {
            id: 11,
            created_at: null,
            photo_path: '/uploads/resource-persons/old-photo.jpg',
            resume_path: '/uploads/resource-persons/old-resume.pdf',
          },
        ],
      ])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    await resourcePersonModel.update(
      11,
      { firstName: 'A', lastName: 'B', professions: '[]' },
      {
        photoFile: [
          { filename: 'new-photo.jpg', mimetype: 'image/jpeg', originalname: 'new.jpg', size: 10 },
        ],
      },
      2,
    );

    expect(deleteUploadedFile).toHaveBeenCalledTimes(1);
    expect(deleteUploadedFile).toHaveBeenCalledWith(expect.stringContaining('old-photo.jpg'));
    expect(connection.commit.mock.invocationCallOrder[0]).toBeLessThan(
      deleteUploadedFile.mock.invocationCallOrder[0],
    );
  });

  // Pins the PR #83 hole: photoPath/resumePath from the body were stored, then deleted
  // on the next replacement, so any user could remove any file under uploads/.
  it('ignores file paths and metadata submitted in the request body', async () => {
    execute
      .mockResolvedValueOnce([{ insertId: 21 }])
      .mockResolvedValueOnce([[{ id: 21, created_at: null }]]);

    await resourcePersonModel.submit(
      {
        firstName: 'A',
        lastName: 'B',
        professions: '[]',
        photoName: 'victim.pdf',
        photoPath: '/uploads/journal-article/victim-article.pdf',
        photoMimeType: 'application/pdf',
        photoFileSize: '999',
        resumeName: 'victim.pdf',
        resumePath: '/uploads/sanctionOrder/victim.pdf',
        resumeMimeType: 'application/pdf',
        resumeFileSize: '999',
      },
      {},
      2,
    );

    const insertValues = execute.mock.calls[0][1];
    expect(insertValues).not.toContain('/uploads/journal-article/victim-article.pdf');
    expect(insertValues).not.toContain('/uploads/sanctionOrder/victim.pdf');
    expect(insertValues).not.toContain('victim.pdf');
    expect(insertValues).not.toContain(999);
  });

  // The owner can remove a stored photo or resume without uploading a replacement.
  it('clears a removed file’s columns and deletes the file after commit', async () => {
    execute
      .mockResolvedValueOnce([
        [
          {
            id: 11,
            created_at: null,
            photo_name: 'old.jpg',
            photo_path: '/uploads/resource-persons/old-photo.jpg',
            resume_path: '/uploads/resource-persons/old-resume.pdf',
          },
        ],
      ])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const saved = await resourcePersonModel.update(
      11,
      {
        firstName: 'A',
        lastName: 'B',
        professions: '[]',
        removePhoto: 'true',
        removeResume: 'false',
      },
      {},
      2,
    );

    const [sql, values] = execute.mock.calls[1];
    expect(sql).toMatch(
      /photo_name = \?, photo_path = \?, photo_mime_type = \?, photo_file_size = \?/,
    );
    expect(sql).not.toMatch(/resume_path/);
    const photoPathIndex = sql
      .slice(sql.indexOf('SET') + 3, sql.indexOf('WHERE'))
      .split(',')
      .findIndex((assignment) => assignment.trim().startsWith('photo_path'));
    expect(values[photoPathIndex]).toBeNull();
    expect(deleteUploadedFile).toHaveBeenCalledTimes(1);
    expect(deleteUploadedFile).toHaveBeenCalledWith(expect.stringContaining('old-photo.jpg'));
    expect(connection.commit.mock.invocationCallOrder[0]).toBeLessThan(
      deleteUploadedFile.mock.invocationCallOrder[0],
    );
    expect(saved.photoPath).toBeNull();
    expect(saved.resumePath).toBe('/uploads/resource-persons/old-resume.pdf');
  });

  it('stores a new file when one arrives alongside a remove flag', async () => {
    execute
      .mockResolvedValueOnce([
        [{ id: 11, created_at: null, photo_path: '/uploads/resource-persons/old-photo.jpg' }],
      ])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    const saved = await resourcePersonModel.update(
      11,
      { firstName: 'A', lastName: 'B', professions: '[]', removePhoto: 'true' },
      {
        photoFile: [
          { filename: 'new-photo.jpg', mimetype: 'image/jpeg', originalname: 'new.jpg', size: 10 },
        ],
      },
      2,
    );

    expect(execute.mock.calls[1][1]).toContain('/uploads/resource-persons/new-photo.jpg');
    expect(saved.photoPath).toBe('/uploads/resource-persons/new-photo.jpg');
    expect(deleteUploadedFile).toHaveBeenCalledWith(expect.stringContaining('old-photo.jpg'));
  });

  it('never deletes a stored file outside uploads/resource-persons/', async () => {
    execute
      .mockResolvedValueOnce([
        [
          {
            id: 11,
            created_at: null,
            photo_path: '/uploads/journal-article/victim-article.pdf',
            resume_path: '/uploads/resource-persons/../sanctionOrder/victim.pdf',
          },
        ],
      ])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await resourcePersonModel.update(
      11,
      { firstName: 'A', lastName: 'B', professions: '[]' },
      {
        photoFile: [
          { filename: 'new-photo.jpg', mimetype: 'image/jpeg', originalname: 'new.jpg', size: 10 },
        ],
        resumeFile: [
          {
            filename: 'new-resume.pdf',
            mimetype: 'application/pdf',
            originalname: 'new.pdf',
            size: 20,
          },
        ],
      },
      2,
    );

    expect(deleteUploadedFile).not.toHaveBeenCalled();
    expect(connection.commit).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it('logs a resource-person resubmission at the directory stage', async () => {
    execute
      .mockResolvedValueOnce([[{ id: 11, created_at: null }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}]);

    await resourcePersonModel.update(
      11,
      { firstName: 'A', lastName: 'B', professions: '[]' },
      {},
      2,
    );

    expect(workflowService.logWorkflowResubmission).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'directory_admin' }),
    );
  });

  it.each(['submit', 'update'])(
    'rejects invalid professions in resource-person %s before opening a transaction',
    async (method) => {
      for (const professions of ['{', '{"not":"an array"}', '[null]']) {
        const payload = { firstName: 'A', lastName: 'B', professions };
        const operation =
          method === 'submit'
            ? resourcePersonModel.submit(payload, {}, 2)
            : resourcePersonModel.update(11, payload, {}, 2);

        await expect(operation).rejects.toMatchObject({
          message: 'Professions must be a JSON array',
          status: 400,
        });
      }

      expect(db.getConnection).not.toHaveBeenCalled();
    },
  );

  // The directory is shared once a record is approved: another user's Approved record
  // is listed, their Pending and Rejected ones are not, and what is listed carries no
  // contact details or reviewer feedback.
  it.each([
    ['organizations', organizationModel.listApproved],
    ['resource persons', resourcePersonModel.list],
  ])('lists only another user’s Approved %s, redacted', async (_label, list) => {
    const otherUsersRows = [
      {
        id: 1,
        created_by: 1,
        is_active: 1,
        updated_by: 8,
        mobile: '9876543210',
        personal_email: 'a@example.org',
        photo_path: '/uploads/resource-persons/a.jpg',
        workflow_state: '{"feedback":"internal note"}',
      },
      { id: 2, created_by: 1, is_active: 0, updated_by: null },
      { id: 3, created_by: 1, is_active: 0, updated_by: 8 },
    ];
    db.query
      .mockImplementationOnce(async (sql, params) => {
        expect(sql).toMatch(/WHERE (\w+\.)?created_by = \? OR (\w+\.)?is_active = 1/);
        return [
          otherUsersRows.filter(
            (row) => Number(row.created_by) === Number(params[0]) || row.is_active === 1,
          ),
        ];
      })
      .mockResolvedValueOnce([[]]);

    const isOrganization = list === organizationModel.listApproved;
    const records = await list.call(
      isOrganization ? organizationModel : resourcePersonModel,
      isOrganization ? 2 : { id: 2 },
    );

    expect(records.map(({ id, approvalStatus, isOwner }) => [id, approvalStatus, isOwner])).toEqual(
      [[1, 'Approved', false]],
    );
    expect(records[0]).not.toHaveProperty('workflow_state');
    if (list === resourcePersonModel.list) {
      for (const field of ['mobile', 'personal_email']) {
        expect(records[0]).not.toHaveProperty(field);
      }
      // The directory is visible to every user; only the contacts are locked.
      expect(records[0].photoPath).toBe('/uploads/resource-persons/a.jpg');
    }
  });

  it.each([
    ['organizations', organizationModel.listApproved],
    ['resource persons', resourcePersonModel.list],
  ])(
    'returns the owner’s Pending, Rejected, and Approved %s with ownership',
    async (_label, list) => {
      db.query
        .mockResolvedValueOnce([
          [
            { id: 1, created_by: 2, is_active: 0, updated_by: null },
            { id: 2, created_by: 2, is_active: 0, updated_by: 8 },
            { id: 3, created_by: 2, is_active: 1, updated_by: 8 },
          ],
        ])
        .mockResolvedValueOnce([[]]);

      const model =
        list === organizationModel.listApproved ? organizationModel : resourcePersonModel;
      const records = await list.call(model, model === organizationModel ? 2 : { id: 2 });

      expect(records.map(({ approvalStatus, isOwner }) => [approvalStatus, isOwner])).toEqual([
        ['Pending', true],
        ['Rejected', true],
        ['Approved', true],
      ]);
      expect(db.query.mock.calls[0][0]).toMatch(/WHERE (\w+\.)?created_by = \?/);
      expect(db.query.mock.calls[0][1]).toEqual([2]);
    },
  );

  it('allows different submitters to create organizations with the same name', async () => {
    execute
      .mockResolvedValueOnce([{ insertId: 31 }])
      .mockResolvedValueOnce([[{ id: 31, created_by: 2 }]])
      .mockResolvedValueOnce([{ insertId: 32 }])
      .mockResolvedValueOnce([[{ id: 32, created_by: 3 }]]);

    await organizationModel.submit({ name: 'Shared name' }, 2);
    await organizationModel.submit({ name: 'Shared name' }, 3);

    const inserts = execute.mock.calls.filter(([sql]) =>
      sql.startsWith('INSERT INTO organizations'),
    );
    expect(inserts).toHaveLength(2);
    expect(inserts.map(([, values]) => values.at(-1))).toEqual([2, 3]);
  });

  // The dashboards swap the save response into their list and show Edit only when
  // isOwner is set; a response without it hid the button until a reload.
  it.each([
    [
      'organization submit',
      () => organizationModel.submit({ name: 'Org', status: 'Active' }, 2),
      [[{ insertId: 31 }], [[{ id: 31, created_by: 2, name: 'Org', status: 'Active' }]]],
    ],
    [
      'organization update',
      () => organizationModel.update(31, { name: 'Org' }, 2),
      [[[{ id: 31 }]], [{}], [[{ id: 31, created_by: 2, name: 'Org' }]]],
    ],
    [
      'resource-person submit',
      () => resourcePersonModel.submit({ firstName: 'A', lastName: 'B', professions: '[]' }, {}, 2),
      [[{ insertId: 21 }], [[{ id: 21, created_by: 2 }]]],
    ],
    [
      'resource-person update',
      () =>
        resourcePersonModel.update(21, { firstName: 'A', lastName: 'B', professions: '[]' }, {}, 2),
      [[[{ id: 21, created_by: 2 }]], [{}], [{}]],
    ],
  ])('returns an owned Pending record from %s', async (_label, save, results) => {
    for (const result of results) execute.mockResolvedValueOnce(result);

    await expect(save()).resolves.toMatchObject({ approvalStatus: 'Pending', isOwner: true });
  });

  it('shows a super-admin their own rejected submission as Rejected', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 5, created_by: 9, is_active: 0, updated_by: 9 }]])
      .mockResolvedValueOnce([[]]);

    const [record] = await resourcePersonModel.list({ id: 9, isSuperAdmin: true });

    expect(record.approvalStatus).toBe('Rejected');
  });

  it('enforces organization-name uniqueness per submitter', async () => {
    execute.mockRejectedValueOnce({ code: 'ER_DUP_ENTRY' });

    await expect(organizationModel.submit({ name: 'Already used' }, 2)).rejects.toMatchObject({
      code: 'ER_DUP_ENTRY',
    });
    expect(execute.mock.calls[0][1].at(-1)).toBe(2);
    expect(connection.rollback).toHaveBeenCalledOnce();
  });

  it('keeps non-owner contact-field redaction as defense in depth', async () => {
    db.query
      .mockResolvedValueOnce([
        [
          {
            id: 1,
            address: 'private address',
            created_by: 1,
            dob: '1980-01-01',
            is_active: 1,
            linked_in: 'https://linkedin.example/person',
            mobile: '9999999999',
            official_email: 'official@example.test',
            personal_email: 'personal@example.test',
            photo_name: 'photo.jpg',
            photo_path: '/uploads/resource-persons/photo.jpg',
            photo_mime_type: 'image/jpeg',
            photo_file_size: 100,
            resume_name: 'resume.pdf',
            resume_path: '/uploads/resource-persons/resume.pdf',
            resume_mime_type: 'application/pdf',
            resume_file_size: 200,
          },
        ],
      ])
      .mockResolvedValueOnce([
        [{ id: 7, resource_person_id: 1, organization: 'Org', official_email: 'hod@x.edu' }],
      ]);

    const [person] = await resourcePersonModel.list({ id: 2 });

    expect(person.isOwner).toBe(false);
    // The form shows the withheld fields locked instead of blank.
    expect(person.contactHidden).toBe(true);
    // LinkedIn is public, by the owner's decision of 2026-10-26.
    expect(person.linkedIn).toBe('https://linkedin.example/person');
    expect(person.professions).toEqual([
      expect.not.objectContaining({ official_email: expect.anything() }),
    ]);
    expect(person.professions[0]).not.toHaveProperty('officialEmail');
    expect(person.professions[0].organization).toBe('Org');
    for (const field of [
      'dob',
      'mobile',
      'personal_email',
      'personalEmail',
      'official_email',
      'officialEmail',
      'address',
      'resume_name',
      'resumeName',
      'resume_path',
      'resumePath',
      'resume_mime_type',
      'resume_file_size',
    ]) {
      expect(person).not.toHaveProperty(field);
    }
    // The photo is a directory detail, visible to every user; the resume is locked.
    expect(person.photoPath).toBe('/uploads/resource-persons/photo.jpg');
  });

  // Approved organizations are shared but names are unique only per submitter, so a second
  // user's copy of an approved organization must not be approved into the directory.
  it('refuses to approve an organization that duplicates an approved one', async () => {
    db.execute.mockResolvedValueOnce([[{ id: 3 }]]);

    await expect(organizationModel.review(9, 'approve', { userId: 1 })).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/already in the directory/),
    });
    expect(db.execute.mock.calls[0][0]).toMatch(/existing\.is_active = 1/);
    expect(db.execute.mock.calls[0][0]).toMatch(/REGEXP_REPLACE\(TRIM\(existing\.name\)/);
    expect(db.execute.mock.calls[0][1]).toEqual([9]);
    expect(workflowService.actOnWorkflow).not.toHaveBeenCalled();
  });

  it('approves an organization whose name is not already approved', async () => {
    db.execute.mockResolvedValueOnce([[]]);

    await expect(organizationModel.review(9, 'approve', { userId: 1 })).resolves.toEqual({
      id: 9,
      status: 'Approved',
    });
    expect(workflowService.actOnWorkflow).toHaveBeenCalledOnce();
  });

  it('rejects a duplicate without the duplicate check', async () => {
    await organizationModel.review(9, 'reject', { userId: 1 });

    expect(db.execute).not.toHaveBeenCalled();
    expect(workflowService.actOnWorkflow).toHaveBeenCalledOnce();
  });
});

// A reviewer may correct a Pending submission before deciding on it. The edit must leave
// is_active/updated_by alone (updated_by alone reads as Rejected) and start no workflow
// step, and a record already decided stays as it was decided.
describe('organization reviewer edits', () => {
  beforeEach(() => {
    execute.mockReset();
    connection.commit.mockReset();
    connection.rollback.mockReset();
    connection.release.mockReset();
    workflowService.startWorkflow.mockReset();
    workflowService.actOnWorkflow.mockReset();
  });

  it('updates a Pending submission in place without touching its approval state', async () => {
    execute
      .mockResolvedValueOnce([[{ id: 10, is_active: 0, updated_by: null }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([
        [{ id: 10, name: 'Fixed', created_by: 4, submitted_by_name: 'Submitter' }],
      ]);

    const result = await organizationModel.updateSubmission(10, { name: 'Fixed' });

    expect(execute.mock.calls[1][0]).toMatch(/^UPDATE organizations SET name = \?/);
    expect(execute.mock.calls[1][0]).not.toMatch(/is_active|updated_by|created_by/);
    expect(execute.mock.calls[1][1].at(-1)).toBe(10);
    expect(workflowService.startWorkflow).not.toHaveBeenCalled();
    expect(workflowService.actOnWorkflow).not.toHaveBeenCalled();
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      id: 10,
      approvalStatus: 'Pending',
      submitted_by: 4,
      submitted_by_name: 'Submitter',
    });
  });

  it.each([
    ['Approved', { is_active: 1, updated_by: 8 }],
    ['Rejected', { is_active: 0, updated_by: 8 }],
  ])('refuses to edit an %s submission', async (_state, row) => {
    execute.mockResolvedValueOnce([[{ id: 10, ...row }]]);

    await expect(organizationModel.updateSubmission(10, { name: 'Fixed' })).rejects.toMatchObject({
      message: 'Only pending organizations can be edited.',
      status: 409,
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.release).toHaveBeenCalledOnce();
  });

  it('reports a missing submission as not found', async () => {
    execute.mockResolvedValueOnce([[]]);

    await expect(organizationModel.updateSubmission(99, { name: 'Fixed' })).rejects.toThrow(
      'Organization not found',
    );
    expect(connection.rollback).toHaveBeenCalledOnce();
  });
});

// Contact details reach the owner, and super admins on the dashboard as on the approval
// page. The person-level official_email is LEGACY: its stale copy never leaves the server,
// and the address now lives on each profession row.
describe('resource person contacts', () => {
  beforeEach(() => {
    execute.mockReset();
    connection.commit.mockReset();
    connection.rollback.mockReset();
    db.query.mockReset();
    workflowService.startWorkflow.mockReset();
  });

  const otherUsersRecord = {
    id: 1,
    created_by: 1,
    is_active: 1,
    mobile: '9999999999',
    personal_email: 'personal@example.test',
    official_email: 'legacy@example.test',
  };

  it('shows a super admin another user’s contacts in full', async () => {
    db.query
      .mockResolvedValueOnce([[otherUsersRecord]])
      .mockResolvedValueOnce([
        [{ id: 7, resource_person_id: 1, official_email: 'hod@x.edu', org_linked_in: null }],
      ]);

    const [person] = await resourcePersonModel.list({ id: 2, isSuperAdmin: true });

    expect(person.isOwner).toBe(false);
    expect(person.contactHidden).toBeUndefined();
    expect(person.mobile).toBe('9999999999');
    expect(person.personalEmail).toBe('personal@example.test');
    expect(person.professions[0].officialEmail).toBe('hod@x.edu');
    expect(person).not.toHaveProperty('official_email');
    expect(person).not.toHaveProperty('officialEmail');
  });

  it('still withholds contacts from a user who is neither owner nor super admin', async () => {
    db.query.mockResolvedValueOnce([[otherUsersRecord]]).mockResolvedValueOnce([[]]);

    const [person] = await resourcePersonModel.list({ id: 2, isSuperAdmin: false });

    expect(person.contactHidden).toBe(true);
    expect(person).not.toHaveProperty('mobile');
  });

  it('saves the official email on each profession row, not on the person', async () => {
    execute
      .mockResolvedValueOnce([{ insertId: 40 }])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ id: 40, created_by: 2 }]]);

    await resourcePersonModel.submit(
      {
        firstName: 'A',
        lastName: 'B',
        officialEmail: 'ignored@example.test',
        professions: JSON.stringify([{ organization: 'Org', officialEmail: 'hod@x.edu' }]),
      },
      {},
      2,
    );

    const [personSql, personValues] = execute.mock.calls[0];
    expect(personSql).not.toMatch(/official_email/);
    expect(personValues).not.toContain('ignored@example.test');
    const [professionSql, professionValues] = execute.mock.calls[1];
    expect(professionSql).toMatch(/org_linked_in, official_email, status/);
    expect(professionValues).toContain('hod@x.edu');
  });
});

// Tag and Specializations are picked from the Directory Admin's lists, never typed: the
// server refuses a value the list lacks, stores the list's spelling, and still accepts a
// retired value on a record that already holds it.
describe('resource person Tag and Specialization lists', () => {
  beforeEach(() => {
    execute.mockReset();
    connection.commit.mockReset();
    connection.rollback.mockReset();
    specializationRows.mockReset();
    db.execute.mockReset();
    activeOptions.splice(
      0,
      activeOptions.length,
      { list_key: 'tag', name: 'Skilling' },
      { list_key: 'specialization', name: 'Machine Learning' },
      { list_key: 'specialization', name: 'Microbiology' },
    );
    storedSpecializations.splice(0);
  });

  it('stores listed picks in the list’s spelling', async () => {
    execute
      .mockResolvedValueOnce([{ insertId: 50 }])
      .mockResolvedValueOnce([[{ id: 50, created_by: 2 }]]);

    const saved = await resourcePersonModel.submit(
      {
        firstName: 'A',
        lastName: 'B',
        tag: 'skilling',
        specializations: JSON.stringify(['microbiology', 'Machine Learning', 'MICROBIOLOGY']),
      },
      {},
      2,
    );

    const [personSql, personValues] = execute.mock.calls[0];
    expect(personSql).not.toMatch(/specialization/);
    expect(personValues).toContain('Skilling');
    const inserted = specializationRows.mock.calls
      .filter(([sql]) => sql.startsWith('INSERT'))
      .map(([, params]) => params);
    expect(inserted).toEqual([
      [50, 'Microbiology', 0],
      [50, 'Machine Learning', 1],
    ]);
    expect(saved.specializations).toEqual(['Microbiology', 'Machine Learning']);
    expect(saved).not.toHaveProperty('specialization');
  });

  it.each([
    [{ tag: 'Typed tag' }, '"Typed tag" is not in the Tag list.'],
    [
      { specializations: JSON.stringify(['Astrology']) },
      '"Astrology" is not in the Specialization list.',
    ],
  ])('refuses a value the list does not have (%j)', async (input, message) => {
    await expect(
      resourcePersonModel.submit({ firstName: 'A', lastName: 'B', ...input }, {}, 2),
    ).rejects.toMatchObject({ message, status: 400 });
    expect(execute).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
  });

  it('keeps a retired value the record already holds when it is edited', async () => {
    storedSpecializations.push({ name: 'Old Field' });
    execute
      .mockResolvedValueOnce([[{ id: 21, created_by: 2, tag: 'Retired Tag' }]])
      .mockResolvedValue([{}]);

    const saved = await resourcePersonModel.update(
      21,
      {
        firstName: 'A',
        lastName: 'B',
        tag: 'Retired Tag',
        specializations: JSON.stringify(['Old Field', 'Microbiology']),
      },
      {},
      2,
    );

    expect(saved.tag).toBe('Retired Tag');
    expect(saved.specializations).toEqual(['Old Field', 'Microbiology']);
    expect(specializationRows.mock.calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(true);
  });

  it('retires an entry still in use instead of deleting it', async () => {
    db.execute
      .mockResolvedValueOnce([[{ list_key: 'specialization', name: 'Microbiology' }]])
      .mockResolvedValueOnce([[{ used: 3 }]])
      .mockResolvedValueOnce([{}]);

    await expect(resourcePersonModel.deleteOption(9)).resolves.toEqual({
      id: 9,
      deleted: false,
      deactivated: true,
    });
    expect(db.execute.mock.calls[2][0]).toMatch(/SET is_active = 0/);
  });

  it('deletes an entry no record uses', async () => {
    db.execute
      .mockResolvedValueOnce([[{ list_key: 'tag', name: 'Unused' }]])
      .mockResolvedValueOnce([[{ used: 0 }]])
      .mockResolvedValueOnce([{}]);

    await expect(resourcePersonModel.deleteOption(9)).resolves.toMatchObject({ deleted: true });
    expect(db.execute.mock.calls[2][0]).toMatch(/^DELETE FROM directory_resource_person_options/);
  });

  it('answers an entry already in the list with a 409', async () => {
    execute.mockResolvedValueOnce([[{ id: 3 }]]);

    await expect(
      resourcePersonModel.addOptions('specialization', { name: ' microbiology ' }),
    ).rejects.toMatchObject({ status: 409, message: '"microbiology" is already in the list.' });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][1]).toEqual(['specialization', 'microbiology']);
    expect(connection.rollback).toHaveBeenCalledOnce();
  });

  // "A, B, C" on the Add form arrives as several names: the new ones are added, and names
  // already listed (or repeated in the request) are skipped, not fatal. Whether a name is
  // listed is the database's call under the column's collation, which also ignores accents:
  // with "Café" listed, "Cafe" must be skipped, not fail the whole add on the unique key.
  it('adds several entries at once and skips the ones the database finds listed', async () => {
    execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 7 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 8 }])
      .mockResolvedValueOnce([[{ id: 2 }]])
      .mockResolvedValueOnce([
        [
          { id: 7, list_key: 'specialization', name: 'Chemistry', is_active: 1 },
          { id: 8, list_key: 'specialization', name: 'Physics', is_active: 1 },
        ],
      ]);

    const result = await resourcePersonModel.addOptions('specialization', {
      names: ['Chemistry', ' Physics ', 'Cafe', 'chemistry'],
    });

    const lookups = execute.mock.calls.filter(([sql]) => /^SELECT id FROM/.test(sql));
    expect(lookups.map(([, values]) => values[1])).toEqual(['Chemistry', 'Physics', 'Cafe']);
    expect(execute.mock.calls[1][1]).toEqual(['specialization', 'Chemistry', 1]);
    expect(execute.mock.calls[3][1]).toEqual(['specialization', 'Physics', 1]);
    expect(connection.commit).toHaveBeenCalledOnce();
    expect(result).toEqual({
      added: [
        { id: 7, list_key: 'specialization', name: 'Chemistry', is_active: true },
        { id: 8, list_key: 'specialization', name: 'Physics', is_active: true },
      ],
      skipped: ['Cafe'],
    });
  });

  it('skips a name another admin added since the check, keeping the rest', async () => {
    execute
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }))
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 8 }])
      .mockResolvedValueOnce([[{ id: 8, list_key: 'tag', name: 'Physics', is_active: 1 }]]);

    const result = await resourcePersonModel.addOptions('tag', { names: ['Chemistry', 'Physics'] });

    expect(result.skipped).toEqual(['Chemistry']);
    expect(result.added.map((row) => row.name)).toEqual(['Physics']);
    expect(connection.commit).toHaveBeenCalledOnce();
  });

  // A Tag is stored in the records' VARCHAR(100) tag column; a longer entry could be picked
  // but never saved.
  it('limits a Tag to 100 characters and a Specialization to 255', async () => {
    await expect(
      resourcePersonModel.addOptions('tag', { name: 'x'.repeat(101) }),
    ).rejects.toMatchObject({ status: 400, message: 'Name must be 100 characters or fewer.' });
    db.execute.mockResolvedValueOnce([[{ list_key: 'tag', name: 'Short' }]]);
    await expect(
      resourcePersonModel.updateOption(4, { name: 'x'.repeat(101) }),
    ).rejects.toMatchObject({ status: 400, message: 'Name must be 100 characters or fewer.' });
    await expect(
      resourcePersonModel.addOptions('specialization', { name: 'x'.repeat(256) }),
    ).rejects.toMatchObject({ status: 400, message: 'Name must be 255 characters or fewer.' });
  });

  // The forms send General when no Tag is chosen and the columns default to it, so its entry
  // can be neither renamed, retired nor deleted; the migration also counts on the Tag list
  // never emptying again.
  it.each([
    ['renamed', (id) => resourcePersonModel.updateOption(id, { name: 'Misc' })],
    [
      'retired',
      (id) => resourcePersonModel.updateOption(id, { name: 'General', is_active: false }),
    ],
    ['deleted', (id) => resourcePersonModel.deleteOption(id)],
  ])('refuses to let the General Tag be %s', async (_label, act) => {
    db.execute.mockResolvedValueOnce([[{ list_key: 'tag', name: 'General' }]]);

    await expect(act(1)).rejects.toMatchObject({
      status: 400,
      message:
        '"General" is the Tag a record gets when none is chosen, so it stays in the list as it is.',
    });
    expect(db.execute).toHaveBeenCalledOnce();
  });

  it('still lets a General Specialization be retired', async () => {
    db.execute
      .mockResolvedValueOnce([[{ list_key: 'specialization', name: 'General' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([
        [{ id: 1, list_key: 'specialization', name: 'General', is_active: 0 }],
      ]);

    await expect(
      resourcePersonModel.updateOption(1, { name: 'General', is_active: false }),
    ).resolves.toMatchObject({ is_active: false });
  });
});

// The organization form follows the same list rules, against its own lists; the legacy
// free-text `sector` column is neither written nor returned.
describe('organization Tag and Specialization lists', () => {
  beforeEach(() => {
    execute.mockReset();
    connection.commit.mockReset();
    connection.rollback.mockReset();
    specializationRows.mockReset();
    activeOptions.splice(
      0,
      activeOptions.length,
      { list_key: 'tag', name: 'Research' },
      { list_key: 'specialization', name: 'Chemistry' },
    );
    storedSpecializations.splice(0);
  });

  it('stores listed picks for a new organization and never writes sector', async () => {
    execute
      .mockResolvedValueOnce([{ insertId: 60 }])
      .mockResolvedValueOnce([[{ id: 60, created_by: 2, sector: 'stale' }]]);

    const saved = await organizationModel.submit(
      { name: 'Org', tag: 'research', sector: 'Typed', specializations: ['chemistry'] },
      2,
    );

    const [orgSql, orgValues] = execute.mock.calls[0];
    expect(orgSql).not.toMatch(/sector/);
    expect(orgValues).toContain('Research');
    expect(specializationRows.mock.calls.find(([sql]) => sql.startsWith('INSERT'))[1]).toEqual([
      60,
      'Chemistry',
      0,
    ]);
    expect(saved.specializations).toEqual(['Chemistry']);
    expect(saved).not.toHaveProperty('sector');
  });

  it('refuses an organization Specialization the list does not have', async () => {
    await expect(
      organizationModel.submit({ name: 'Org', specializations: ['Astrology'] }, 2),
    ).rejects.toMatchObject({
      status: 400,
      message: '"Astrology" is not in the Specialization list.',
    });
    expect(execute).not.toHaveBeenCalled();
  });
});

// A resource person is not approved while an organization it names is still Pending or
// was Rejected: the two approvals are separate, so without this a record could be shared
// pointing at an organization that never reaches the directory.
describe('resource person approval waits for its organizations', () => {
  beforeEach(() => {
    execute.mockReset();
    connection.commit.mockReset();
    connection.rollback.mockReset();
    db.query.mockReset();
    workflowService.actOnWorkflow.mockReset();
  });

  // Each approval first locks the person row, then reads its holds.
  const holdRows = (rows) =>
    execute.mockResolvedValueOnce([[{ id: 5 }]]).mockResolvedValueOnce([rows]);

  it.each([
    [
      { name: 'National Chemical Laboratory', approved: 0, pending: 1 },
      'Approve the organization "National Chemical Laboratory" first; it is still pending.',
    ],
    [
      { name: 'Old Org', approved: 0, pending: 0 },
      'The organization "Old Org" was rejected; the submitter needs to choose another.',
    ],
  ])('refuses to approve while an organization is held (%j)', async (row, message) => {
    holdRows([{ resource_person_id: 5, ...row }]);

    await expect(resourcePersonModel.review(5, 'approve', { id: 1 })).rejects.toMatchObject({
      status: 409,
      message,
    });
    expect(workflowService.actOnWorkflow).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
  });

  it('approves when an Approved organization carries the name', async () => {
    holdRows([{ resource_person_id: 5, name: 'IISc', approved: 1, pending: 1 }]);
    workflowService.actOnWorkflow.mockResolvedValueOnce({});

    await expect(resourcePersonModel.review(5, 'approve', { id: 1 })).resolves.toBeTruthy();
    expect(workflowService.actOnWorkflow).toHaveBeenCalledOnce();
  });

  // Pins the race the review of #89 found: the check ran before, and outside, the approving
  // transaction, so an edit saved in between was approved unchecked. Now the person row is
  // locked first, the holds are read with share locks, and the decision joins that same
  // transaction, committing or rolling back with the check.
  it('checks the holds inside the approving transaction, after locking the person', async () => {
    holdRows([]);
    workflowService.actOnWorkflow.mockResolvedValueOnce({});

    await resourcePersonModel.review(5, 'approve', { id: 1 });

    expect(connection.beginTransaction).toHaveBeenCalled();
    expect(execute.mock.calls[0][0]).toMatch(
      /FROM directory_resource_persons WHERE id = \? FOR UPDATE$/,
    );
    expect(execute.mock.calls[1][0]).toMatch(/FOR SHARE$/);
    expect(workflowService.actOnWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'approved', tx: connection }),
    );
    expect(connection.commit).toHaveBeenCalledOnce();
  });

  it('never holds a rejection', async () => {
    workflowService.actOnWorkflow.mockResolvedValueOnce({});

    await resourcePersonModel.review(5, 'reject', { id: 1 });

    expect(execute).not.toHaveBeenCalled();
    expect(workflowService.actOnWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ decision: 'rejected', tx: connection }),
    );
  });
});

// A profession row links to its organization by id, so a rename carries through and holds
// follow the organization itself. Only an organization the submitter can see may be
// picked -- an Approved one or their own -- and never a Rejected one.
describe('resource person profession organization link', () => {
  beforeEach(() => {
    execute.mockReset();
    connection.commit.mockReset();
    connection.rollback.mockReset();
    db.query.mockReset();
    db.query.mockImplementation(async (sql, params) => answerListQuery(sql, params) ?? [[]]);
    activeOptions.splice(0);
    storedOrganizationLinks.splice(0);
  });

  const submitWith = (organizationId) =>
    resourcePersonModel.submit(
      {
        firstName: 'A',
        lastName: 'B',
        professions: JSON.stringify([{ organization: 'Typed Name', organizationId }]),
      },
      {},
      2,
    );

  it('stores the id and the organization’s current name', async () => {
    execute
      .mockResolvedValueOnce([{ insertId: 70 }])
      .mockResolvedValueOnce([
        [{ id: 9, name: 'Renamed Org', is_active: 1, updated_by: 4, created_by: 3 }],
      ])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ id: 70, created_by: 2 }]]);

    const saved = await submitWith(9);

    const [sql, values] = execute.mock.calls[2];
    expect(sql).toMatch(/organization, organization_id, city/);
    expect(values.slice(0, 5)).toEqual([70, null, null, 'Renamed Org', 9]);
    expect(saved.professions[0]).toMatchObject({ organization: 'Renamed Org', organizationId: 9 });
  });

  it.each([
    [
      'a Rejected organization',
      { id: 9, name: 'Gone', is_active: 0, updated_by: 4, created_by: 2 },
      '"Gone" was rejected. Choose another organization.',
    ],
    [
      'another user’s Pending organization',
      { id: 9, name: 'Theirs', is_active: 0, updated_by: null, created_by: 5 },
      'Organization not found. Choose it again.',
    ],
  ])('refuses %s', async (_label, org, message) => {
    execute.mockResolvedValueOnce([{ insertId: 70 }]).mockResolvedValueOnce([[org]]);

    await expect(submitWith(9)).rejects.toMatchObject({ status: 400, message });
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
  });

  // Pins the review finding on #89: the edit form sends every row's stored organizationId
  // back, so a link to another user's organization that went back to Pending (its owner
  // edited it, or the migration linked it) must not block the owner's save.
  const editWith = (organizationId) =>
    resourcePersonModel.update(
      30,
      {
        firstName: 'A',
        lastName: 'B',
        professions: JSON.stringify([{ organization: 'Theirs', organizationId }]),
      },
      {},
      2,
    );
  const theirPendingOrg = { id: 9, name: 'Theirs', is_active: 0, updated_by: null, created_by: 5 };

  it('keeps a stored link to another user’s Pending organization on edit, with its hold', async () => {
    storedOrganizationLinks.push({ organization_id: 9 });
    execute
      .mockResolvedValueOnce([[{ id: 30, created_by: 2 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[theirPendingOrg]])
      .mockResolvedValue([{}]);

    const saved = await editWith(9);

    expect(connection.commit).toHaveBeenCalledOnce();
    expect(saved.professions[0]).toMatchObject({ organization: 'Theirs', organizationId: 9 });
    expect(saved.organizationHolds).toEqual([{ name: 'Theirs', status: 'Pending' }]);
  });

  // A loaded profession carries both officialEmail and official_email, and the form edits
  // only the first; clearing it must remove the address, not fall back to the stored one.
  it('clears an official email the owner emptied on edit', async () => {
    execute
      .mockResolvedValueOnce([[{ id: 30, created_by: 2 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValue([{}]);

    await resourcePersonModel.update(
      30,
      {
        firstName: 'A',
        lastName: 'B',
        professions: JSON.stringify([
          { designation: 'HOD', officialEmail: '', official_email: 'old@college.edu' },
        ]),
      },
      {},
      2,
    );

    const [, values] = execute.mock.calls.find(([sql]) =>
      sql.startsWith('INSERT INTO directory_resource_person_professions'),
    );
    expect(values[9]).toBeNull();
  });

  // The queue's Organization column follows a rename, as the record's details do.
  it('shows the queue a linked organization under its current name', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 3, created_by: 2, is_active: 0, approvalStatus: 'Pending' }]])
      .mockResolvedValueOnce([
        [
          {
            id: 1,
            resource_person_id: 3,
            organization: 'Old Name',
            organization_id: 9,
            linked_organization_name: 'New Name',
            organization_status: 'Approved',
          },
        ],
      ]);

    const [row] = await resourcePersonModel.pending();

    expect(row.organization).toBe('New Name');
  });

  it('still refuses another user’s Pending organization the record did not hold', async () => {
    execute
      .mockResolvedValueOnce([[{ id: 30, created_by: 2 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[theirPendingOrg]]);

    await expect(editWith(9)).rejects.toMatchObject({
      status: 400,
      message: 'Organization not found. Choose it again.',
    });
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledOnce();
  });

  it('shows a linked organization under its current name', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 3, created_by: 2, is_active: 1 }]])
      .mockResolvedValueOnce([
        [
          {
            id: 1,
            resource_person_id: 3,
            organization: 'Old Name',
            organization_id: 9,
            linked_organization_name: 'New Name',
            organization_status: 'Approved',
          },
        ],
      ]);

    const [person] = await resourcePersonModel.list({ id: 2 });

    expect(person.professions[0]).toMatchObject({
      organization: 'New Name',
      organizationId: 9,
      organizationStatus: 'Approved',
    });
    expect(person.professions[0]).not.toHaveProperty('linked_organization_name');
  });
});

// Who added a record stays visible to every reader, even where the record's own contacts
// are locked: the directory shows it so a reader can ask that colleague about the record.
describe('directory submitter', () => {
  beforeEach(() => {
    db.query.mockReset();
    db.query.mockImplementation(async (sql, params) => answerListQuery(sql, params) ?? [[]]);
  });

  it('reads the submitter with the list and keeps it on a redacted record', async () => {
    db.query.mockResolvedValueOnce([
      [
        {
          id: 1,
          created_by: 5,
          is_active: 1,
          mobile: '9999999999',
          submitted_by_name: 'Kathirselvam M',
          submitted_by_email: 'kathir@example.edu',
        },
      ],
    ]);

    const [person] = await resourcePersonModel.list({ id: 2 });

    expect(db.query.mock.calls[0][0]).toMatch(/LEFT JOIN users u ON u\.id = rp\.created_by/);
    expect(person.contactHidden).toBe(true);
    expect(person).not.toHaveProperty('mobile');
    expect(person).toMatchObject({
      submitted_by_name: 'Kathirselvam M',
      submitted_by_email: 'kathir@example.edu',
    });
  });
});
