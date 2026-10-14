import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({ default: { execute: vi.fn(), query: vi.fn() } }));

const db = (await import('../config/connection.js')).default;
const { default: formOptionsModel } = await import('../modules/formOptions/formOptionsModel.js');
const { loadProjectVocabulary } = await import('../modules/shared/projectVocabularyStore.js');

beforeEach(() => {
  db.query.mockReset();
});

/**
 * National Initiatives, Domains and Categories are one table, told apart by
 * `list_key`. A category belongs to one project type's list; the other two
 * store '' so the unique key (list, type, name) still holds for them.
 */
describe('vocabulary entry checks', () => {
  it('stores a trimmed name, with no project type on an untyped list', async () => {
    db.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([{ insertId: 7 }]);

    const entry = await formOptionsModel.addProjectVocabularyEntry('domain', {
      name: '  Quantum Computing ',
      project_type: 'event',
    });

    expect(entry).toMatchObject({ id: 7, name: 'Quantum Computing', project_type: '' });
    const [, params] = db.query.mock.calls[1];
    expect(params.slice(0, 3)).toEqual(['domain', '', 'Quantum Computing']);
  });

  it('requires a known project type for a category', async () => {
    await expect(
      formOptionsModel.addProjectVocabularyEntry('category', { name: 'Hackathon' }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/project type/) });
    await expect(
      formOptionsModel.addProjectVocabularyEntry('category', {
        name: 'Hackathon',
        project_type: 'consultancy',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('refuses a blank name and a name already on the list', async () => {
    await expect(
      formOptionsModel.addProjectVocabularyEntry('national_initiative', { name: '  ' }),
    ).rejects.toMatchObject({ statusCode: 400 });

    db.query.mockResolvedValueOnce([[{ id: 3 }]]);
    await expect(
      formOptionsModel.addProjectVocabularyEntry('national_initiative', { name: 'Skill India' }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  // A rename checks against the other entries only, or saving an entry
  // unchanged would collide with itself.
  it('excludes the entry itself when checking a rename', async () => {
    db.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

    expect(
      await formOptionsModel.updateProjectVocabularyEntry('category', 12, {
        name: 'Seminar',
        project_type: 'event',
        sort_order: 3,
      }),
    ).toBe(true);

    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/id <> \?/);
    expect(params).toEqual(['category', 'event', 'Seminar', 12]);
  });
});

/**
 * Values are stored by name on projects and schemes, so an entry something
 * already holds is deactivated rather than deleted — the record keeps showing
 * it, and it is still matched when that record is saved again.
 */
describe('vocabulary entry delete', () => {
  it('deactivates a category a scheme of that type still holds', async () => {
    db.query
      .mockResolvedValueOnce([[{ name: 'Seminar', project_type: 'event' }]])
      .mockResolvedValueOnce([[{ references_count: 1 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    expect(await formOptionsModel.deleteProjectVocabularyEntry('category', 4)).toEqual({
      deactivated: true,
    });
    expect(db.query.mock.calls[1][1]).toEqual(['Seminar', 'event']);
    expect(db.query.mock.calls[2][0]).toMatch(/SET is_active = 0/);
  });

  it('counts a domain on projects and on schemes', async () => {
    db.query
      .mockResolvedValueOnce([[{ name: 'Energy', project_type: '' }]])
      .mockResolvedValueOnce([[{ references_count: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    expect(await formOptionsModel.deleteProjectVocabularyEntry('domain', 5)).toBe(true);
    const [usageSql, usageParams] = db.query.mock.calls[1];
    expect(usageSql).toMatch(/research_projects/);
    expect(usageSql).toMatch(/project_schemes/);
    expect(usageParams).toEqual(['Energy', 'Energy']);
    expect(db.query.mock.calls[2][0]).toMatch(/^DELETE/);
  });

  it('counts a national initiative on project tags', async () => {
    db.query
      .mockResolvedValueOnce([[{ name: 'Skill India', project_type: '' }]])
      .mockResolvedValueOnce([[{ references_count: 2 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    await formOptionsModel.deleteProjectVocabularyEntry('national_initiative', 6);
    expect(db.query.mock.calls[1][0]).toMatch(/project_tags/);
  });

  // The entry is looked up within its own list, so an id from another tab
  // cannot delete a row there.
  it('answers not found for an id on another list', async () => {
    db.query.mockResolvedValueOnce([[]]);

    expect(await formOptionsModel.deleteProjectVocabularyEntry('domain', 99)).toBe(false);
    expect(db.query.mock.calls[0][1]).toEqual([99, 'domain']);
  });
});

describe('loadProjectVocabulary', () => {
  it('groups the rows by list, and categories by project type', async () => {
    db.query.mockResolvedValueOnce([
      [
        { list_key: 'category', project_type: 'event', name: 'Seminar' },
        { list_key: 'category', project_type: 'research_project', name: 'Survey' },
        { list_key: 'domain', project_type: '', name: 'Energy' },
        { list_key: 'national_initiative', project_type: '', name: 'Skill India' },
      ],
    ]);

    expect(await loadProjectVocabulary()).toEqual({
      nationalInitiatives: ['Skill India'],
      domains: ['Energy'],
      categoriesByType: { event: ['Seminar'], research_project: ['Survey'] },
    });
    expect(db.query.mock.calls[0][0]).toMatch(/is_active = 1/);
  });

  // Matching a value a record already holds reads retired entries too.
  it('reads retired entries when asked for every entry', async () => {
    db.query.mockResolvedValueOnce([[]]);

    await loadProjectVocabulary({ activeOnly: false });
    expect(db.query.mock.calls[0][0]).not.toMatch(/is_active/);
  });
});
