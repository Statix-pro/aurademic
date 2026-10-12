import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({ default: { execute: vi.fn(), query: vi.fn() } }));

const db = (await import('../config/connection.js')).default;
const { default: projectModel } = await import('../modules/project/projectModel.js');

const journalRow = (overrides) => ({
  id: 7,
  title: 'Solar drying of millets',
  type: 'Journal',
  year: '2026',
  book_chapter_title: null,
  journal_name: 'Journal of Food Engineering',
  ...overrides,
});

// The Fetch button's portal match maps the journal form's free-text `type` onto
// the Outcomes tab's three types. A Book is none of them and must come back
// unset for the user to pick; it used to fall through `??` and read as a journal.
describe('findPublicationByDoi', () => {
  beforeEach(() => db.query.mockReset());

  it('leaves the type unset for a Book', async () => {
    db.query.mockResolvedValueOnce([[journalRow({ type: 'Book' })]]);
    const match = await projectModel.findPublicationByDoi('10.1000/book');
    expect(match.publication_type).toBeNull();
  });

  it('maps conference papers and book chapters, and anything else to journal', async () => {
    db.query.mockResolvedValueOnce([[journalRow({ type: 'Conference paper' })]]);
    expect((await projectModel.findPublicationByDoi('10.1000/a')).publication_type).toBe(
      'conference',
    );

    db.query.mockResolvedValueOnce([
      [journalRow({ type: 'Book Chapter', book_chapter_title: 'Advances in Drying' })],
    ]);
    const chapter = await projectModel.findPublicationByDoi('10.1000/b');
    expect(chapter.publication_type).toBe('book_chapter');
    expect(chapter.venue).toBe('Advances in Drying');

    db.query.mockResolvedValueOnce([[journalRow({ type: 'Journal' })]]);
    expect((await projectModel.findPublicationByDoi('10.1000/c')).publication_type).toBe('journal');
  });

  it('returns null when the portal holds no record for the DOI', async () => {
    db.query.mockResolvedValueOnce([[]]);
    expect(await projectModel.findPublicationByDoi('10.1000/none')).toBeNull();
  });
});
