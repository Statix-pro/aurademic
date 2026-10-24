import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({ default: { execute: vi.fn(), query: vi.fn() } }));

// The curated lists, as `project_vocabulary_options` would hold them. Mocked at
// the loader so the scheme-update tests below see the same `db.query` calls
// they pin, with the lists read from here.
const DOMAINS = ['Artificial Intelligence', 'Energy'];
const CATEGORIES_BY_TYPE = {
  research_project: ['Research Project', 'Industrial R&D'],
  event: ['Seminar'],
  travel_grant: ['Conference Travel Grant'],
  fellowship: ['Women Scientist'],
};
vi.mock('../modules/shared/projectVocabularyStore.js', () => ({
  VOCABULARY_LISTS: ['national_initiative', 'domain', 'category'],
  loadProjectVocabulary: vi.fn(async () => ({
    nationalInitiatives: [],
    domains: DOMAINS,
    categoriesByType: CATEGORIES_BY_TYPE,
  })),
}));

const db = (await import('../config/connection.js')).default;
const { default: formOptionsModel } = await import('../modules/formOptions/formOptionsModel.js');
const { toSchemeCategory, toSchemeDomain, toSchemeProjectType } =
  await import('../modules/shared/schemeVocabulary.js');

/**
 * A new domain or category for a scheme is picked from the curated lists and
 * stored as the label. A value off the list would never be offered by the
 * dropdowns, so it is refused at the point it is stored — as a 400, since the
 * person submitting can fix it.
 */
describe('scheme domain and category', () => {
  const domain = (value, type = 'research_project') => toSchemeDomain(value, type, DOMAINS);
  const category = (value, type = 'research_project') =>
    toSchemeCategory(value, type, CATEGORIES_BY_TYPE);

  it('stores the listed label, whatever case it arrives in', () => {
    expect(domain('artificial intelligence')).toBe('Artificial Intelligence');
    expect(category(' Industrial R&D ')).toBe('Industrial R&D');
  });

  it('treats an empty value as "not stated"', () => {
    expect(domain('')).toBeNull();
    expect(category(undefined)).toBeNull();
  });

  // Each kind of grant has its own categories: a Seminar is an event's, not a
  // research project's, and a travel grant scheme has no domain at all.
  it("checks the category against the scheme type's own list", () => {
    expect(category('seminar', 'event')).toBe('Seminar');
    expect(category('Women Scientist', 'fellowship')).toBe('Women Scientist');
    expect(() => category('Seminar', 'research_project')).toThrowError(/category/);
    expect(() => category('Research Project', 'travel_grant')).toThrowError(/category/);
  });

  it('keeps no domain on a travel grant scheme', () => {
    expect(domain('Energy', 'travel_grant')).toBeNull();
    expect(domain('Energy', 'event')).toBe('Energy');
  });

  it('reads an unstated scheme type as a research project and refuses an unknown one', () => {
    expect(toSchemeProjectType(undefined)).toBe('research_project');
    expect(() => toSchemeProjectType('consultancy')).toThrowError(/kind of grant/);
  });

  it('answers 400 for a value off the list', () => {
    let caught;
    try {
      category('Consultancy');
    } catch (error) {
      caught = error;
    }
    expect(caught?.statusCode).toBe(400);
    expect(caught?.message).toMatch(/category from the list/);
  });
});

describe('scheme update with a pre-list value', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  const stored = {
    organization_id: 3,
    project_type: 'research_project',
    domain: 'Renewable energy',
    category: 'Grant',
  };
  const update = (changes) =>
    formOptionsModel.updateProjectScheme(9, {
      organization_id: 3,
      project_type: 'research_project',
      name: 'SERB-POWER',
      domain: stored.domain,
      category: stored.category,
      ...changes,
    });

  // Editing a scheme's name must not be blocked by a domain the lists no
  // longer offer — renamed or retired in the admin, or free text saved before
  // the lists existed — which the admin did not touch.
  it('keeps an untouched free-text value', async () => {
    db.query.mockResolvedValueOnce([[stored]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

    expect(await update({ name: 'SERB-POWER (renamed)' })).toBe(true);

    const [, params] = db.query.mock.calls[1];
    expect(params.slice(3, 5)).toEqual(['Renewable energy', 'Grant']);
  });

  // Free text could have been stored with a trailing space; sent back as the
  // form shows it, without the space, it is still the untouched value.
  it('keeps an untouched free-text value stored with surrounding spaces', async () => {
    db.query
      .mockResolvedValueOnce([[{ ...stored, domain: 'Renewable energy ' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    expect(await update({ domain: 'Renewable energy', website: 'https://serb.gov.in' })).toBe(true);

    const [, params] = db.query.mock.calls[1];
    expect(params[3]).toBe('Renewable energy ');
  });

  it('requires a listed value once it is changed', async () => {
    db.query.mockResolvedValueOnce([[stored]]);

    await expect(update({ domain: 'Solar' })).rejects.toMatchObject({ statusCode: 400 });
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});

/**
 * A project's scheme must be of the project's own type, so retyping a scheme
 * that projects already use would fail every one of them on its next save —
 * refused, the way moving it to another agency is.
 */
describe('scheme type change', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  const stored = {
    organization_id: 3,
    project_type: 'research_project',
    domain: 'Energy',
    category: 'Research Project',
  };
  const retype = () =>
    formOptionsModel.updateProjectScheme(9, {
      organization_id: 3,
      project_type: 'event',
      name: 'SERB-POWER',
      domain: 'Energy',
      category: 'Seminar',
    });

  it('is refused while projects use the scheme', async () => {
    db.query.mockResolvedValueOnce([[stored]]).mockResolvedValueOnce([[{ references_count: 2 }]]);

    await expect(retype()).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/project type cannot be changed/),
    });
  });

  it('is saved, with a category from the new list, when nothing uses it', async () => {
    db.query
      .mockResolvedValueOnce([[stored]])
      .mockResolvedValueOnce([[{ references_count: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    expect(await retype()).toBe(true);
    const [, params] = db.query.mock.calls[2];
    expect(params.slice(1, 5)).toEqual(['event', 'SERB-POWER', 'Energy', 'Seminar']);
  });
});
