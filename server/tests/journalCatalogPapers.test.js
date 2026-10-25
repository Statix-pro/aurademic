/**
 * The paper import writes approved publications and decides who they are credited to, so
 * these pin the rules that keep it honest: staff are credited by Scopus Author ID and never by
 * a look-alike name, a paper the portal already has is filled rather than copied and nothing a
 * person typed is overwritten, retracted papers and errata stay out, and anything that would
 * be cut or misfiled waits for a person instead.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));

const db = (await import('../config/connection.js')).default;
const { readSourceFile } = await import('../modules/journalCatalog/importReader.js');
const { getSource } = await import('../modules/journalCatalog/sources.js');
const { planPapers } = await import('../modules/journalCatalog/paperPlanner.js');
const { default: paperImportModel } = await import('../modules/journalCatalog/paperImportModel.js');

const HEADERS = [
  'Authors',
  'Author full names',
  'Author(s) ID',
  'Title',
  'Year',
  'Source title',
  'Volume',
  'Issue',
  'Art. No.',
  'Page start',
  'Page end',
  'DOI',
  'Authors with affiliations',
  'Abstract',
  'Author Keywords',
  'Publisher',
  'Conference name',
  'Conference date',
  'Conference location',
  'ISSN',
  'ISBN',
  'PubMed ID',
  'Document Type',
  'Open Access',
  'EID',
];

const KSRCT = 'K.S.Rangasamy College of Technology, Tiruchengode, India';

const paperRow = (overrides = {}) => ({
  Authors: 'Raja K.; Smith J.',
  'Author full names': 'Raja, K. (57225844882); Smith, John (11111111111)',
  'Author(s) ID': '57225844882; 11111111111',
  Title: 'Tribology of sesbania fibre composites',
  Year: '2025',
  'Source title': 'Journal of Natural Fibers',
  Volume: '22',
  Issue: '1',
  'Art. No.': '',
  'Page start': '10',
  'Page end': '20',
  DOI: '10.1080/15440478.2025.1',
  'Authors with affiliations': `Raja K., ${KSRCT}; Smith J., Dept of Physics, University of Leeds, Leeds, United Kingdom`,
  Abstract: 'An abstract.',
  'Author Keywords': 'fibres; tribology; composites',
  Publisher: 'Taylor and Francis',
  'Conference name': '',
  'Conference date': '',
  'Conference location': '',
  ISSN: '15440478',
  ISBN: '',
  'PubMed ID': '',
  'Document Type': 'Article',
  'Open Access': 'All Open Access; Gold Open Access',
  EID: '2-s2.0-85000000001',
  ...overrides,
});

const quote = (value) => `"${String(value).replace(/"/g, '""')}"`;
const csv = (rows) =>
  Buffer.from(
    [
      HEADERS.map(quote).join(','),
      ...rows.map((row) => HEADERS.map((header) => quote(row[header] ?? '')).join(',')),
    ].join('\n'),
  );

const readPapers = (rows) => readSourceFile(getSource('scopus_papers'), csv(rows));

const JOURNAL = {
  id: 40,
  journal_name: 'Journal of Natural Fibers',
  print_issn: '1544-0478',
  online_issn: '',
  category: 'International',
  is_placeholder: 0,
  metrics: {},
};

const STAFF = { id: 7, scopus_id: '57225844882', name: 'K Raja' };

const plan = async (
  rows,
  { journals = [JOURNAL], publications = [], employees = [STAFF] } = {},
) => {
  const { records, excluded } = await readPapers(rows);
  return planPapers({ records, journals, publications, employees, excluded });
};

describe('reading the Scopus export as papers', () => {
  it('stores the EID the way the form does, without the 2-s2.0- prefix', async () => {
    const { records } = await readPapers([paperRow()]);
    expect(records[0]).toMatchObject({
      scopusId: '85000000001',
      type: 'Article',
      year: 2025,
      pagesFrom: 10,
      pagesTo: 20,
      openAccess: 'Yes',
      keywords: 'fibres; tribology; composites',
    });
  });

  it('marks only the authors who gave a KSRCT affiliation as KSRCT', async () => {
    const { records } = await readPapers([paperRow()]);
    expect(records[0].authors).toEqual([
      expect.objectContaining({ position: 1, scopusAuthorId: '57225844882', ksrct: true }),
      expect.objectContaining({ position: 2, scopusAuthorId: '11111111111', ksrct: false }),
    ]);
  });

  it('leaves out retracted papers, errata and types the form has no option for', async () => {
    const { records, excluded } = await readPapers([
      paperRow({ 'Document Type': 'Retracted', EID: '2-s2.0-1' }),
      paperRow({ 'Document Type': 'Erratum', EID: '2-s2.0-2' }),
      paperRow({ 'Document Type': 'Letter', EID: '2-s2.0-3' }),
      paperRow({ 'Document Type': 'Data paper', EID: '2-s2.0-4' }),
    ]);
    expect(records).toHaveLength(0);
    expect(excluded).toEqual({ retracted: 1, erratum: 1, type_not_on_form: 2 });
  });

  it('leaves out a paper with no KSRCT author', async () => {
    const { excluded } = await readPapers([
      paperRow({
        'Authors with affiliations':
          'Raja K., K.S.R. College of Engineering, India; Smith J., University of Leeds, United Kingdom',
      }),
    ]);
    expect(excluded).toEqual({ not_ksrct: 1 });
  });

  it('keeps a paper whose author lists do not line up for review instead of dropping it', async () => {
    const { records } = await readPapers([
      paperRow({ 'Authors with affiliations': `Raja K., ${KSRCT}` }),
    ]);
    expect(records[0].issues[0]).toMatch(/cannot be told apart/);
    expect(records[0].authors.every((author) => !author.ksrct)).toBe(true);
  });

  it('keeps page numbers that are not plain numbers out of the numeric page fields', async () => {
    const { records } = await readPapers([
      paperRow({ 'Page start': 's1139', 'Page end': 's1145' }),
    ]);
    expect(records[0]).toMatchObject({ pagesFrom: null, pagesTo: null });
    expect(records[0].notes[0]).toMatch(/not plain numbers/);
  });
});

describe('planning papers', () => {
  it('credits a staff member by Scopus Author ID and files the paper on its journal', async () => {
    const { rows, summary } = await plan([paperRow()]);
    expect(rows[0]).toMatchObject({ outcome: 'add', journal_option_id: 40 });
    expect(rows[0].payload.journal).toMatchObject({ kind: 'journal', journalOptionId: 40 });
    expect(rows[0].changes).toContainEqual({ field: 'Credited to', from: null, to: 'K Raja' });
    expect(summary.papers).toEqual({ credited: 1, unassigned: 0 });
  });

  it('never credits by name: a KSRCT author with no Scopus ID on file leaves the paper unassigned', async () => {
    const { rows, summary } = await plan([paperRow()], {
      employees: [{ id: 8, scopus_id: '99999999999', name: 'K Raja' }],
    });
    expect(rows[0].outcome).toBe('add');
    expect(rows[0].changes.find((change) => change.field === 'Credited to').to).toMatch(
      /^Unassigned/,
    );
    expect(summary.papers).toEqual({ credited: 0, unassigned: 1 });
  });

  it('does not credit a staff member whose Scopus ID belongs to a non-KSRCT author position', async () => {
    const { summary } = await plan([paperRow()], {
      employees: [{ id: 9, scopus_id: '11111111111', name: 'J Smith' }],
    });
    expect(summary.papers.credited).toBe(0);
  });

  it('counts only papers being added as credited or unassigned', async () => {
    const { summary } = await plan([paperRow()], { journals: [] });
    expect(summary.outcomes.exception).toBe(1);
    expect(summary.papers).toEqual({ credited: 0, unassigned: 0 });
  });

  it('credits a paper already imported once its author’s Scopus ID is on file', async () => {
    const imported = {
      id: 400,
      scopus_id: '85000000001',
      title: 'Tribology of sesbania fibre composites',
      year: '2025',
      doi: '10.1080/15440478.2025.1',
      volume: '22',
      issue: '1',
      pages_from: 10,
      pages_to: 20,
      abstract: 'An abstract.',
      keywords: 'fibres; tribology; composites',
      open_access: 'Yes',
      linkedEmployeeIds: [],
      hasScopusAuthors: true,
    };
    const { rows } = await plan([paperRow()], { publications: [imported] });
    expect(rows[0]).toMatchObject({ outcome: 'update', publication_id: 400 });
    expect(rows[0].payload.set).toEqual({});
    expect(rows[0].changes).toEqual([{ field: 'Credited to', from: null, to: 'K Raja' }]);
  });

  it('files a conference paper under a stand-in row named after the conference', async () => {
    const { rows } = await plan([
      paperRow({
        'Document Type': 'Conference paper',
        'Source title': 'AIP Conference Proceedings',
        'Conference name': 'ICAMM 2025',
        'Conference location': 'Chennai',
        ISSN: '',
      }),
    ]);
    expect(rows[0].outcome).toBe('add');
    expect(rows[0].payload.journal).toMatchObject({ kind: 'placeholder', name: 'ICAMM 2025' });
    expect(rows[0].payload.publication.publication_details).toMatchObject({
      conference_title: 'ICAMM 2025',
      source: 'AIP Conference Proceedings',
      city: 'Chennai',
    });
  });

  it('puts a book chapter in the book named by Scopus', async () => {
    const { rows } = await plan([
      paperRow({ 'Document Type': 'Book chapter', 'Source title': 'Textile Advances', ISSN: '' }),
    ]);
    expect(rows[0].payload.publication).toMatchObject({
      type: 'Book Chapter',
      book_chapter_title: 'Textile Advances',
    });
  });

  it('holds back a journal paper whose journal is not in the list', async () => {
    const { rows } = await plan([paperRow()], { journals: [] });
    expect(rows[0].outcome).toBe('exception');
    expect(rows[0].reason).toMatch(/not in the journal list/);
  });

  it('holds back a paper whose ISSN is on a differently named journal in the list', async () => {
    const { rows } = await plan([paperRow()], {
      journals: [{ ...JOURNAL, journal_name: 'Materials Today: Proceedings' }],
    });
    expect(rows[0].outcome).toBe('exception');
    expect(rows[0].reason).toMatch(/is on "Materials Today: Proceedings"/);
  });

  it('holds back a value that would not fit its column rather than cut it', async () => {
    const { rows } = await plan([paperRow({ Title: 'x'.repeat(300) })]);
    expect(rows[0].outcome).toBe('exception');
    expect(rows[0].reason).toMatch(/Title is 300 characters/);
  });

  it('flags the second paper of the file with the same DOI', async () => {
    const { rows } = await plan([paperRow(), paperRow({ EID: '2-s2.0-85000000002' })]);
    expect(rows.map((row) => row.outcome)).toEqual(['add', 'exception']);
    expect(rows[1].reason).toMatch(/Same DOI as line 2/);
  });

  it('fills only the blank fields of a paper the portal already has, matched by EID', async () => {
    const existing = {
      id: 300,
      scopus_id: '85000000001',
      title: 'Typed by the author',
      year: '2025',
      doi: '',
      volume: '21',
      abstract: null,
      journal_options_id: 40,
      linkedEmployeeIds: [7],
      hasScopusAuthors: false,
    };
    const { rows } = await plan([paperRow()], { publications: [existing] });
    expect(rows[0]).toMatchObject({ outcome: 'update', publication_id: 300 });
    expect(rows[0].payload.set).toMatchObject({
      doi: '10.1080/15440478.2025.1',
      abstract: 'An abstract.',
    });
    // The author's own volume stays.
    expect(rows[0].payload.set).not.toHaveProperty('volume');
  });

  it("does not raise the file's journal problems against a paper the portal already has", async () => {
    const existing = {
      id: 301,
      scopus_id: '85000000001',
      title: 'x',
      year: '2025',
      linkedEmployeeIds: [7],
      hasScopusAuthors: true,
      doi: '10.1080/15440478.2025.1',
      volume: '22',
      issue: '1',
      pages_from: 10,
      pages_to: 20,
      abstract: 'a',
      keywords: 'k',
      open_access: 'Yes',
    };
    const { rows } = await plan([paperRow()], { publications: [existing], journals: [] });
    expect(rows[0].outcome).toBe('unchanged');
  });

  it('matches an entered paper by DOI, and reviews it when its EID disagrees', async () => {
    const base = {
      id: 302,
      title: 'x',
      year: '2025',
      doi: 'https://doi.org/10.1080/15440478.2025.1',
    };
    const same = await plan([paperRow()], { publications: [{ ...base, scopus_id: '' }] });
    expect(same.rows[0]).toMatchObject({ outcome: 'update', publication_id: 302 });

    const other = await plan([paperRow()], {
      publications: [{ ...base, scopus_id: '85999999999' }],
    });
    expect(other.rows[0].outcome).toBe('exception');
    expect(other.rows[0].reason).toMatch(/same DOI but Scopus EID 2-s2.0-85999999999/);
  });

  it('matches an entered paper with no identifiers by title and year, and says so', async () => {
    const { rows } = await plan([paperRow()], {
      publications: [
        {
          id: 303,
          title: 'TRIBOLOGY OF SESBANIA FIBRE COMPOSITES',
          year: '2025',
          doi: null,
          scopus_id: null,
        },
      ],
    });
    expect(rows[0]).toMatchObject({ outcome: 'update', publication_id: 303 });
    expect(rows[0].reason).toMatch(/Matched publication #303 by title and year/);
  });
});

/** A fake pooled connection whose `query` answers by matching the SQL text. */
const collapse = (sql) => String(sql).replace(/\s+/g, ' ').trim();
const makeConnection = (respond) => ({
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  query: vi.fn(async (sql, params) => respond(collapse(sql), params)),
});

describe('applying papers', () => {
  beforeEach(() => {
    db.getConnection.mockReset();
  });

  const applyOne = async (payload, { employees = [STAFF], publications = [] } = {}) => {
    const writes = [];
    const connection = makeConnection((sql, params) => {
      if (sql.startsWith('SELECT id, status FROM journal_import_batches')) {
        return [[{ id: 1, status: 'previewed' }]];
      }
      if (sql.startsWith('SELECT id, journal_name')) return [[JOURNAL]];
      if (sql.startsWith('SELECT journal_option_id, metric')) return [[]];
      if (sql.startsWith('SELECT e.id, TRIM(e.scopus_id)')) return [employees];
      if (sql.startsWith('SELECT id, TRIM(scopus_id)')) return [publications];
      if (sql.startsWith('SELECT 1 FROM author_journal')) return [[]];
      if (sql.startsWith('SELECT e.id, x.scopus_author_id')) return [[]];
      if (sql.startsWith('SELECT id FROM authors WHERE employee_id')) return [[]];
      if (sql.startsWith('SELECT id, outcome, payload FROM journal_import_rows')) {
        return [[{ id: 11, outcome: 'add', payload }]];
      }
      if (sql.startsWith('SELECT value_text FROM journal_metrics_yearly')) {
        return [[{ value_text: 'Q2' }]];
      }
      if (sql.startsWith('SELECT index_name')) return [[]];
      writes.push({ sql, params });
      if (sql.startsWith('INSERT INTO journals')) return [{ insertId: 500 }];
      if (sql.startsWith('INSERT INTO authors')) return [{ insertId: 70 }];
      return [{ affectedRows: 1 }];
    });
    db.getConnection.mockResolvedValue(connection);
    const result = await paperImportModel.applyBatch(1, 9);
    return { result, writes, connection };
  };

  it('adds the paper approved by the importing super admin, with the official quartile', async () => {
    const { rows } = await plan([paperRow()]);
    const { result, writes, connection } = await applyOne(rows[0].payload);

    expect(result).toMatchObject({ added: 1, notApplied: 0 });
    expect(connection.commit).toHaveBeenCalled();
    const insert = writes.find((write) => write.sql.startsWith('INSERT INTO journals'));
    expect(insert.params[0]).toMatchObject({
      title: 'Tribology of sesbania fibre composites',
      scopus_id: '85000000001',
      journal_options_id: 40,
      category: 'International',
      quartile: 'Q2',
      status: 'published',
      admin_approval_status: 'approved',
      admin_approved_by: 9,
      import_batch_id: 1,
    });
  });

  it('links the credited staff member as an author and lists everyone else as external', async () => {
    const { rows } = await plan([paperRow()]);
    const { writes } = await applyOne(rows[0].payload);

    const link = writes.find((write) => write.sql.startsWith('INSERT INTO author_journal'));
    expect(link.params).toEqual([70, 500, 1]);
    const insert = writes.find((write) => write.sql.startsWith('INSERT INTO journals'));
    const external = JSON.parse(insert.params[0].external_details);
    expect(external).toEqual([
      expect.objectContaining({
        name: 'Smith, John',
        organization: 'Dept of Physics, University of Leeds, Leeds',
        country: 'United Kingdom',
        is_first_author: false,
        scopus_author_id: '11111111111',
      }),
    ]);
  });

  it('keeps the KSRCT author of an unassigned paper so a later Scopus ID can credit them', async () => {
    const { rows } = await plan([paperRow()], { employees: [] });
    const { writes } = await applyOne(rows[0].payload, { employees: [] });

    expect(writes.some((write) => write.sql.startsWith('INSERT INTO author_journal'))).toBe(false);
    const scopusAuthors = writes.find((write) =>
      write.sql.startsWith('INSERT INTO journal_scopus_authors'),
    );
    expect(scopusAuthors.params[0][0]).toEqual([500, 1, '57225844882', 'Raja, K.', 1, null, 0]);
  });

  it('records that the import made the staff link, so removing the ID can take it back', async () => {
    const { rows } = await plan([paperRow()]);
    const { writes } = await applyOne(rows[0].payload);
    const scopusAuthors = writes.find((write) =>
      write.sql.startsWith('INSERT INTO journal_scopus_authors'),
    );
    expect(scopusAuthors.params[0][0]).toEqual([500, 1, '57225844882', 'Raja, K.', 1, 7, 1]);
  });

  it('does not add a paper filed on the form with the same DOI since the preview', async () => {
    const { rows } = await plan([paperRow()]);
    const { result, writes } = await applyOne(rows[0].payload, {
      publications: [{ id: 610, scopus_id: null, doi: 'https://doi.org/10.1080/15440478.2025.1' }],
    });
    expect(result).toMatchObject({ added: 0, notApplied: 1 });
    expect(writes.some((write) => write.sql.startsWith('INSERT INTO journals'))).toBe(false);
    const flagged = writes.find((write) =>
      write.sql.startsWith('UPDATE journal_import_rows SET outcome'),
    );
    expect(flagged.params[0]).toMatch(/now in the portal as publication #610/);
  });

  it('credits a Scopus ID filled in between preview and apply', async () => {
    const { rows } = await plan([paperRow()], { employees: [] });
    const { writes } = await applyOne(rows[0].payload, { employees: [STAFF] });
    expect(writes.some((write) => write.sql.startsWith('INSERT INTO author_journal'))).toBe(true);
  });
});
