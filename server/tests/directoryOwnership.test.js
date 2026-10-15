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
  default: { startWorkflow: vi.fn(), actOnWorkflow: vi.fn() },
}));

import db from '../config/connection.js';
import organizationModel from '../modules/organizationDirectory/organizationDirectoryModel.js';
import resourcePersonModel from '../modules/resourcepersonDirectory/resourcepersonDirectoryModel.js';

describe('directory owner-only edits', () => {
  beforeEach(() => {
    execute.mockReset();
    connection.beginTransaction.mockReset();
    connection.commit.mockReset();
    connection.rollback.mockReset();
    connection.release.mockReset();
    db.query.mockReset();
  });

  it('allows an organization owner to edit their record', async () => {
    execute
      .mockResolvedValueOnce([[{ id: 10 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ id: 10, name: 'Updated', category: 'Academic', tag: 'General' }]]);

    await expect(organizationModel.update(10, { name: 'Updated' }, 2)).resolves.toBeTruthy();
    expect(execute.mock.calls[0][1]).toEqual([10, 2]);
    expect(execute.mock.calls[1][0]).toMatch(/is_active = 0, updated_by = NULL/);
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

  it.each([
    ['organizations', organizationModel.listApproved],
    ['resource persons', resourcePersonModel.list],
  ])('does not return another user’s %s in any approval state', async (_label, list) => {
    const rows = [
      { id: 1, created_by: 1, is_active: 1, updated_by: 8 },
      { id: 2, created_by: 1, is_active: 0, updated_by: null },
      { id: 3, created_by: 1, is_active: 0, updated_by: 8 },
    ];
    db.query.mockImplementationOnce(async (sql, params) => {
      expect(sql).toMatch(/WHERE created_by = \?/);
      expect(sql).not.toMatch(/is_active\s*=\s*1\s+OR/i);
      return [rows.filter((row) => Number(row.created_by) === Number(params[0]))];
    });

    await expect(
      list.call(
        list === organizationModel.listApproved ? organizationModel : resourcePersonModel,
        2,
      ),
    ).resolves.toEqual([]);
    expect(db.query.mock.calls[0][1]).toEqual([2]);
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
    execute.mockResolvedValueOnce([{ insertId: 31 }]).mockResolvedValueOnce([{ insertId: 32 }]);

    await organizationModel.submit({ name: 'Shared name' }, 2);
    await organizationModel.submit({ name: 'Shared name' }, 3);

    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls.map(([, values]) => values.at(-1))).toEqual([2, 3]);
    expect(execute.mock.calls.every(([sql]) => sql.startsWith('INSERT INTO organizations'))).toBe(
      true,
    );
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
