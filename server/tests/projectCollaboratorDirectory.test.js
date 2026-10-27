import { describe, expect, it, vi } from 'vitest';

import {
  fillDirectoryCollaborators,
  loadDirectoryEmailOnFile,
  pickDirectoryProfession,
} from '../modules/shared/directoryCollaborators.js';

// Answers the three directory lookups by their SQL, so each test only states the records.
const directory = ({ organizations = [], people = [], professions = [] } = {}) => ({
  query: vi.fn(async (sql, [ids]) => {
    if (/FROM organizations/.test(sql))
      return [organizations.filter((row) => ids.includes(row.id))];
    if (/FROM directory_resource_persons/.test(sql))
      return [people.filter((row) => ids.includes(row.id))];
    if (/FROM directory_resource_person_professions/.test(sql))
      return [professions.filter((row) => ids.includes(row.resource_person_id))];
    throw new Error(`Unexpected query: ${sql}`);
  }),
});

const approvedOrg = { id: 5, name: 'IIT Madras', city: 'Chennai', is_active: 1 };
const person = { id: 9, name: 'Dr. Asha Rao', is_active: 1 };

describe('pickDirectoryProfession', () => {
  // The designation shown on a project must be the person's post at that collaborator.
  it('prefers the current post at the collaborating organization', () => {
    const professions = [
      { designation: 'Professor', organization_id: 1, status: 'Working' },
      { designation: 'Lecturer', organization_id: 5, status: 'Relieved' },
      { designation: 'Dean', organization_id: 5, status: 'Working' },
    ];
    expect(pickDirectoryProfession(professions, 5).designation).toBe('Dean');
    expect(pickDirectoryProfession(professions, '5').designation).toBe('Dean');
  });

  it('falls back to a post they left there, then their current post, then the first', () => {
    const left = [
      { designation: 'Professor', organization_id: 1, status: 'Working' },
      { designation: 'Lecturer', organization_id: 5, status: 'Relieved' },
    ];
    expect(pickDirectoryProfession(left, 5).designation).toBe('Lecturer');
    expect(pickDirectoryProfession(left, 7).designation).toBe('Professor');
    expect(
      pickDirectoryProfession([{ designation: 'Retired', status: 'Relieved' }], null).designation,
    ).toBe('Retired');
    expect(pickDirectoryProfession([], 5)).toBeNull();
  });
});

describe('fillDirectoryCollaborators', () => {
  // A locked field must not be changeable by calling the API: linked values come from the
  // directory whatever the payload says.
  it('overwrites linked fields from the directory and never stores the email', async () => {
    const connection = directory({
      organizations: [approvedOrg],
      people: [person],
      professions: [
        {
          resource_person_id: 9,
          organization_id: 5,
          designation: 'Dean',
          official_email: 'dean@iitm.example',
          status: 'Working',
        },
      ],
    });

    const { rows, errors } = await fillDirectoryCollaborators(connection, [
      {
        sourceIndex: 0,
        directory_organization_id: 5,
        organization_name: 'Typed name',
        city: 'Typed city',
        directory_resource_person_id: 9,
        contact_name: 'Someone else',
        contact_designation: 'Typed',
        contact_email: 'typed@example.test',
      },
    ]);

    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      organization_name: 'IIT Madras',
      city: 'Chennai',
      contact_name: 'Dr. Asha Rao',
      contact_designation: 'Dean',
      contact_email: null,
    });
  });

  it('leaves free-text rows as they were and runs no query for them', async () => {
    const connection = directory();
    const row = { sourceIndex: 0, organization_name: 'Typed', contact_email: 'a@b.example' };

    const { rows, errors } = await fillDirectoryCollaborators(connection, [row]);

    expect(errors).toEqual([]);
    expect(rows).toEqual([row]);
    expect(connection.query).not.toHaveBeenCalled();
  });

  // The saver's own Pending record is usable (a submitter may add and use a record at once);
  // Rejected or deleted records must be re-picked, reported on the row the form rendered.
  it('accepts the saver’s own Pending record and refuses a Rejected or missing one', async () => {
    const connection = directory({
      organizations: [
        { id: 6, name: 'Pending Org', city: null, is_active: 0, updated_by: null, created_by: 4 },
        { id: 7, name: 'Rejected Org', city: null, is_active: 0, updated_by: 3, created_by: 4 },
      ],
    });

    const { rows, errors } = await fillDirectoryCollaborators(
      connection,
      [
        { sourceIndex: 0, directory_organization_id: 6 },
        { sourceIndex: 2, directory_organization_id: 7 },
        { sourceIndex: 3, directory_resource_person_id: 40 },
      ],
      { userId: 4 },
    );

    expect(rows[0].organization_name).toBe('Pending Org');
    expect(errors.map((error) => error.field)).toEqual([
      'collaborators[2].organization',
      'collaborators[3].contact_name',
    ]);
  });

  // Another user's Pending record is private to them in the directory, so linking it by id
  // would copy its name and post into a project the saver can read back.
  it('refuses another user’s Pending record unless the project already links it', async () => {
    const records = {
      organizations: [
        { id: 6, name: 'Their Org', city: 'Salem', is_active: 0, updated_by: null, created_by: 8 },
      ],
      people: [{ id: 9, name: 'Dr. Their Pick', is_active: 0, updated_by: null, created_by: 8 }],
    };
    const rows = [
      { sourceIndex: 0, directory_organization_id: 6, directory_resource_person_id: 9 },
    ];

    const refused = await fillDirectoryCollaborators(directory(records), rows, { userId: 4 });
    expect(refused.errors.map((error) => error.field)).toEqual([
      'collaborators[0].organization',
      'collaborators[0].contact_name',
    ]);

    // A co-editor saving a row the record's owner linked earlier keeps it.
    const kept = await fillDirectoryCollaborators(directory(records), rows, {
      userId: 4,
      keptOrganizationIds: new Set([6]),
      keptPersonIds: new Set([9]),
    });
    expect(kept.errors).toEqual([]);
    expect(kept.rows[0]).toMatchObject({ organization_name: 'Their Org', city: 'Salem' });
  });

  // The directory allows a 255-character designation; the project column holds 150, and a
  // longer value would fail the whole project save under strict mode.
  it('cuts a directory designation to the project column’s length', async () => {
    const connection = directory({
      people: [person],
      professions: [{ resource_person_id: 9, designation: 'D'.repeat(255), status: 'Working' }],
    });

    const { rows } = await fillDirectoryCollaborators(connection, [
      { sourceIndex: 0, directory_resource_person_id: 9 },
    ]);

    expect(rows[0].contact_designation).toHaveLength(150);
  });
});

describe('loadDirectoryEmailOnFile', () => {
  it('says whether the post the designation came from has an email', async () => {
    const connection = directory({
      professions: [
        { resource_person_id: 9, organization_id: 5, official_email: null, status: 'Working' },
        { resource_person_id: 9, organization_id: 1, official_email: 'x@y.example' },
        { resource_person_id: 10, organization_id: 1, official_email: 'p@q.example' },
      ],
    });

    const onFile = await loadDirectoryEmailOnFile(connection, [
      { id: 1, directory_resource_person_id: 9, directory_organization_id: 5 },
      { id: 2, directory_resource_person_id: 10, directory_organization_id: null },
      { id: 3, directory_resource_person_id: null },
    ]);

    expect(onFile.get(1)).toBe(false);
    expect(onFile.get(2)).toBe(true);
    expect(onFile.has(3)).toBe(false);
  });
});
