import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
const connection = {
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  execute,
};

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn(async () => connection), query: vi.fn() },
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
    expect(execute.mock.calls[0][0]).toMatch(/^SELECT id FROM organizations/);
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
        expect(sql).toMatch(/WHERE created_by = \? OR is_active = 1/);
        return [
          otherUsersRows.filter(
            (row) => Number(row.created_by) === Number(params[0]) || row.is_active === 1,
          ),
        ];
      })
      .mockResolvedValueOnce([[]]);

    const records = await list.call(
      list === organizationModel.listApproved ? organizationModel : resourcePersonModel,
      2,
    );

    expect(records.map(({ id, approvalStatus, isOwner }) => [id, approvalStatus, isOwner])).toEqual(
      [[1, 'Approved', false]],
    );
    expect(records[0]).not.toHaveProperty('workflow_state');
    if (list === resourcePersonModel.list) {
      for (const field of ['mobile', 'personal_email', 'photo_path', 'photoPath']) {
        expect(records[0]).not.toHaveProperty(field);
      }
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
      const records = await list.call(model, 2);

      expect(records.map(({ approvalStatus, isOwner }) => [approvalStatus, isOwner])).toEqual([
        ['Pending', true],
        ['Rejected', true],
        ['Approved', true],
      ]);
      expect(db.query.mock.calls[0][0]).toMatch(/WHERE created_by = \?/);
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

    const [record] = await resourcePersonModel.list(9);

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
      .mockResolvedValueOnce([[]]);

    const [person] = await resourcePersonModel.list(2);

    expect(person.isOwner).toBe(false);
    for (const field of [
      'dob',
      'mobile',
      'personal_email',
      'personalEmail',
      'official_email',
      'officialEmail',
      'linked_in',
      'linkedIn',
      'address',
      'photo_name',
      'photoName',
      'photo_path',
      'photoPath',
      'photo_mime_type',
      'photo_file_size',
      'resume_name',
      'resumeName',
      'resume_path',
      'resumePath',
      'resume_mime_type',
      'resume_file_size',
    ]) {
      expect(person).not.toHaveProperty(field);
    }
  });
});
