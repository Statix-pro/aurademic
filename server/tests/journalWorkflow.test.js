import { beforeEach, describe, expect, it, vi } from 'vitest';

import db from '../config/connection.js';
import editRequestModel from '../modules/editRequest/editRequestModel.js';
import journalModel from '../modules/journal/journalModel.js';

vi.mock('../config/connection.js', () => {
  return {
    default: {
      getConnection: vi.fn(),
      query: vi.fn(),
      execute: vi.fn(),
    },
  };
});

/**
 * Journal level (National/International) is curated by admins on `journal_options`, and
 * `journals.category` is only a snapshot of it. Every publication in the reference data
 * read 'National' while pointing at an 'International' journal, because the picker matched
 * journals by name and the form was trusted for the level.
 */
const collectSql = () => db.query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' '));

/** Stands in for a pooled connection inside a transaction. */
const createFakeConnection = (responder) => ({
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  query: vi.fn(async (sql, params) => responder(String(sql).replace(/\s+/g, ' '), params)),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('journal search', () => {
  it('returns the curated category so the form can show the journal level', async () => {
    db.query.mockResolvedValue([[]]);

    await journalModel.searchJournals('carbo');

    const [sql] = collectSql();
    expect(sql).toContain('jo.category');
  });

  it('resolves an ambiguous journal name deterministically', async () => {
    db.query.mockResolvedValue([[]]);

    await journalModel.searchJournals('');

    expect(collectSql()[0]).toContain('FROM journal_options jo');
  });
});

describe('journalModel.create', () => {
  const baseJournal = {
    title: 'A paper',
    type: 'Article',
    journal_name: 'Shared Name',
    category: 'National',
    acknowledgement: {},
    author_affiliation: [],
  };

  it('links to the journal_options id the picker sent rather than re-matching the name', async () => {
    const seen = [];
    const connection = createFakeConnection((sql, params) => {
      seen.push({ sql, params });
      if (sql.includes('SELECT id FROM journal_options WHERE id = ?')) return [[{ id: 7 }]];
      if (sql.includes('SELECT category FROM journal_options'))
        return [[{ category: 'International' }]];
      if (sql.startsWith('INSERT INTO journals SET')) return [{ insertId: 42 }];
      if (sql.includes('FROM journals j')) return [[{ id: 42, category: 'International' }]];
      return [[]];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.create({ ...baseJournal, journal_options_id: 7 });

    // The name lookup must not run at all when an id is supplied: two entries can share a
    // name while carrying different levels.
    expect(seen.some((call) => call.sql.includes('WHERE journal_name = ?'))).toBe(false);

    const insert = seen.find((call) => call.sql.startsWith('INSERT INTO journals SET'));
    expect(insert.params[0].journal_options_id).toBe(7);
  });

  it('takes the level from the registry, not from the submitted form', async () => {
    const connection = createFakeConnection((sql) => {
      if (sql.includes('SELECT id FROM journal_options WHERE id = ?')) return [[{ id: 7 }]];
      if (sql.includes('SELECT category FROM journal_options'))
        return [[{ category: 'International' }]];
      if (sql.startsWith('INSERT INTO journals SET')) return [{ insertId: 42 }];
      if (sql.includes('FROM journals j')) return [[{ id: 42 }]];
      return [[]];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.create({ ...baseJournal, journal_options_id: 7, category: 'National' });

    const insert = connection.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('INSERT INTO journals SET'),
    );
    expect(insert[1][0].category).toBe('International');
  });

  it('falls back to a deterministic name match when no id is supplied', async () => {
    const connection = createFakeConnection((sql) => {
      if (sql.includes('WHERE journal_name = ?')) return [[{ id: 1 }]];
      if (sql.includes('SELECT category FROM journal_options')) return [[{ category: 'National' }]];
      if (sql.startsWith('INSERT INTO journals SET')) return [{ insertId: 43 }];
      if (sql.includes('FROM journals j')) return [[{ id: 43 }]];
      return [[]];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.create(baseJournal);

    const lookup = connection.query.mock.calls.find(([sql]) =>
      String(sql).includes('WHERE journal_name = ?'),
    );
    expect(String(lookup[0]).replace(/\s+/g, ' ')).toContain('ORDER BY id LIMIT 1');
  });

  it('never blanks a curated registry field with an empty submission value', async () => {
    const connection = createFakeConnection((sql) => {
      if (sql.includes('WHERE journal_name = ?')) return [[{ id: 1 }]];
      if (sql.includes('SELECT category FROM journal_options')) return [[{ category: 'National' }]];
      if (sql.startsWith('INSERT INTO journals SET')) return [{ insertId: 44 }];
      if (sql.includes('FROM journals j')) return [[{ id: 44 }]];
      return [[]];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.create({ ...baseJournal, publisher: '', website: '   ' });

    const registryUpdate = connection.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('UPDATE journal_options SET'),
    );
    expect(registryUpdate).toBeUndefined();
  });
});

describe('journalModel.updateJournalAndOptions', () => {
  const linkedRow = [[{ journal_options_id: 3, journal_name: 'Carbohydrate Polymers' }]];

  it('leaves the shared registry name alone when the form submits an empty name', async () => {
    // Book and Book Chapter always submit an empty journal name; the old code wrote it
    // straight onto journal_options and blanked the row for every other publication.
    const connection = createFakeConnection((sql) => {
      if (sql.includes('FROM journals j LEFT JOIN journal_options')) return linkedRow;
      if (sql.includes('SELECT category FROM journal_options')) return [[{ category: 'National' }]];
      return [{ affectedRows: 1 }];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.updateJournalAndOptions(9, { title: 'New title' }, { journal_name: '' });

    const registryWrite = connection.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('UPDATE journal_options SET'),
    );
    expect(registryWrite).toBeUndefined();
  });

  it('re-points the publication instead of renaming the journal it used to cite', async () => {
    const connection = createFakeConnection((sql) => {
      if (sql.includes('FROM journals j LEFT JOIN journal_options')) return linkedRow;
      if (sql.includes('SELECT id FROM journal_options WHERE journal_name = ?'))
        return [[{ id: 8 }]];
      if (sql.includes('SELECT category FROM journal_options'))
        return [[{ category: 'International' }]];
      return [{ affectedRows: 1 }];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.updateJournalAndOptions(9, {}, { journal_name: 'Another Journal' });

    const journalWrite = connection.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('UPDATE journals SET'),
    );
    expect(journalWrite[1][0].journal_options_id).toBe(8);
    expect(journalWrite[1][0].category).toBe('International');
  });

  it('prefers the submitted journal_options_id over the name', async () => {
    const connection = createFakeConnection((sql) => {
      if (sql.includes('FROM journals j LEFT JOIN journal_options')) return linkedRow;
      if (sql.includes('SELECT id FROM journal_options WHERE id = ?')) return [[{ id: 11 }]];
      if (sql.includes('SELECT category FROM journal_options'))
        return [[{ category: 'International' }]];
      return [{ affectedRows: 1 }];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.updateJournalAndOptions(
      9,
      {},
      { journal_name: 'Some Other Name', journal_options_id: 11 },
    );

    expect(
      connection.query.mock.calls.some(([sql]) =>
        String(sql).includes('SELECT id FROM journal_options WHERE journal_name = ?'),
      ),
    ).toBe(false);

    const journalWrite = connection.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('UPDATE journals SET'),
    );
    expect(journalWrite[1][0].journal_options_id).toBe(11);
  });

  it('rolls back and reports when the publication does not exist', async () => {
    const connection = createFakeConnection(() => [[]]);
    db.getConnection.mockResolvedValue(connection);

    await expect(journalModel.updateJournalAndOptions(404, {}, {})).rejects.toThrow(
      /Journal not found/,
    );
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });
});

describe('journalModel.replaceIndexes', () => {
  it('replaces the set, dropping duplicates, blanks and de-selections', async () => {
    const connection = createFakeConnection(() => [{ affectedRows: 1 }]);
    db.getConnection.mockResolvedValue(connection);

    const saved = await journalModel.replaceIndexes(5, ['Scopus', 'scopus', '  ', 'SCIE']);

    expect(saved).toEqual(['Scopus', 'SCIE']);
    const deletion = connection.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('DELETE FROM journal_indexes'),
    );
    expect(deletion[1]).toEqual([5]);
  });

  it('clears every index when nothing is selected', async () => {
    const connection = createFakeConnection(() => [{ affectedRows: 2 }]);
    db.getConnection.mockResolvedValue(connection);

    const saved = await journalModel.replaceIndexes(5, []);

    expect(saved).toEqual([]);
    expect(
      connection.query.mock.calls.some(([sql]) =>
        String(sql).startsWith('INSERT INTO journal_indexes'),
      ),
    ).toBe(false);
  });
});

describe('journalModel.addAuthor', () => {
  it('does not write a country onto author_students, which has no such column', async () => {
    const connection = createFakeConnection((sql) => {
      if (sql.includes('FROM author_students')) return [[]];
      if (sql.startsWith('INSERT INTO author_students')) return [{ insertId: 3 }];
      if (sql.includes('FROM authors WHERE student_ref')) return [[]];
      if (sql.startsWith('INSERT INTO authors SET')) return [{ insertId: 4 }];
      return [{ insertId: 5 }];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.addAuthor(1, {
      designation: 'student',
      author_id: 'REG-1',
      name: 'A Student',
      department: 'CSE',
      organization: 'KSRCT',
      country: 'India',
    });

    const studentInsert = connection.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('INSERT INTO author_students'),
    );
    expect(String(studentInsert[0])).not.toContain('country');
    expect(studentInsert[1]).toEqual(['REG-1', 'A Student', 'CSE', 'KSRCT']);
  });
});

describe('journalModel.deleteAuthorFromJournal', () => {
  it('only unlinks the author from the journal it was asked about', async () => {
    db.query.mockResolvedValue([{ affectedRows: 1 }]);

    await journalModel.deleteAuthorFromJournal(9, 4);

    const [sql] = collectSql();
    expect(sql).toContain('DELETE FROM author_journal WHERE id = ? AND journal_id = ?');
    expect(db.query.mock.calls[0][1]).toEqual([4, 9]);
  });

  it('leaves the shared authors row in place for other publications', async () => {
    db.query.mockResolvedValue([{ affectedRows: 1 }]);

    await journalModel.deleteAuthorFromJournal(9, 4);

    expect(collectSql().some((sql) => sql.includes('DELETE FROM authors'))).toBe(false);
  });
});

describe('journal author payload', () => {
  it('returns country and state, which the v_authors view does not carry', async () => {
    db.query.mockResolvedValue([[]]);

    await journalModel.getAuthors(9);

    const [sql] = collectSql();
    expect(sql).toContain('a.country');
    expect(sql).toContain('a.state');
    expect(sql).toContain('LEFT JOIN authors a ON a.id = v.author_id');
  });
});

describe('editRequestModel.findEditRequest', () => {
  it('answers with the newest request so a re-request is not reported as rejected', async () => {
    db.query.mockResolvedValue([[{ id: 13, status: 'pending' }]]);

    await editRequestModel.findEditRequest(4, 1, 'journals');

    expect(collectSql()[0]).toContain('ORDER BY id DESC LIMIT 1');
  });
});

describe('editRequestModel.updateLatestEditRequestStatus', () => {
  it('scopes the decision to one entity type and one row', async () => {
    // The route parameter is an entity id, so matching on entity_id alone let a journal
    // decision land on the project request that shared that id.
    db.query.mockResolvedValueOnce([[{ id: 13 }]]).mockResolvedValueOnce([{ affectedRows: 1 }]);

    const result = await editRequestModel.updateLatestEditRequestStatus(4, 'journals', 'approved');

    const [lookupSql, updateSql] = collectSql();
    expect(lookupSql).toContain('WHERE entity_id = ? AND entity_type = ?');
    expect(lookupSql).toContain('ORDER BY id DESC LIMIT 1');
    expect(db.query.mock.calls[0][1]).toEqual([4, 'journals']);

    expect(updateSql).toBe('UPDATE edit_requests SET status = ? WHERE id = ?');
    expect(db.query.mock.calls[1][1]).toEqual(['approved', 13]);
    expect(result.affectedRows).toBe(1);
  });

  it('reports nothing updated when the entity has no request of that type', async () => {
    db.query.mockResolvedValueOnce([[]]);

    const result = await editRequestModel.updateLatestEditRequestStatus(
      4,
      'research_projects',
      'approved',
    );

    expect(result).toEqual({ affectedRows: 0 });
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});

describe('journal search excludes book and conference stand-ins', () => {
  it('filters placeholder rows out of the journal picker', async () => {
    db.query.mockResolvedValue([[]]);

    await journalModel.searchJournals('');
    await journalModel.searchJournals('carbo');

    // A conference paper's stand-in row was being offered as a selectable journal, so a
    // user filing an article could pick someone else's conference or book chapter.
    collectSql().forEach((sql) => expect(sql).toContain('jo.is_placeholder = 0'));
  });
});

describe('placeholder registry rows', () => {
  const conferenceSubmission = {
    title: 'A conference paper',
    type: 'Conference paper',
    // A conference paper submits its conference title as the "journal name", which used to
    // send it down the real-journal branch and publish the conference into the picker.
    journal_name: 'Some Conference 2026',
    publication_details: { conference_title: 'Some Conference 2026' },
    acknowledgement: {},
    author_affiliation: [],
  };

  it('marks a conference stand-in as a placeholder even though it has a name', async () => {
    const connection = createFakeConnection((sql) => {
      if (sql.includes('AND is_placeholder = 1')) return [[]];
      if (sql.startsWith('INSERT INTO journal_options')) return [{ insertId: 55 }];
      if (sql.includes('SELECT category FROM journal_options')) return [[{ category: 'National' }]];
      if (sql.startsWith('INSERT INTO journals SET')) return [{ insertId: 66 }];
      if (sql.includes('FROM journals j')) return [[{ id: 66 }]];
      return [[]];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.create(conferenceSubmission);

    const insert = connection.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('INSERT INTO journal_options'),
    );
    expect(String(insert[0]).replace(/\s+/g, ' ')).toContain('is_placeholder');
    expect(String(insert[0]).replace(/\s+/g, ' ')).toContain("VALUES (?, '', '', '', '', 1)");
  });

  it('never reuses a real journal that happens to share a book title', async () => {
    const connection = createFakeConnection((sql) => {
      if (sql.includes('AND is_placeholder = 1')) return [[{ id: 77 }]];
      if (sql.includes('SELECT category FROM journal_options')) return [[{ category: 'National' }]];
      if (sql.startsWith('INSERT INTO journals SET')) return [{ insertId: 67 }];
      if (sql.includes('FROM journals j')) return [[{ id: 67 }]];
      return [[]];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.create({ ...conferenceSubmission, type: 'Book' });

    const lookup = connection.query.mock.calls.find(([sql]) =>
      String(sql).includes('FROM journal_options WHERE journal_name = ?'),
    );
    expect(String(lookup[0])).toContain('is_placeholder = 1');
  });

  it('keeps a renamed book on a placeholder row instead of minting a journal', async () => {
    const connection = createFakeConnection((sql) => {
      if (sql.includes('FROM journals j LEFT JOIN journal_options')) {
        return [[{ journal_options_id: 77, type: 'Book', journal_name: 'Old Book' }]];
      }
      if (sql.includes('AND is_placeholder = 1')) return [[]];
      if (sql.startsWith('INSERT INTO journal_options')) return [{ insertId: 78 }];
      if (sql.includes('SELECT category FROM journal_options')) return [[{ category: 'National' }]];
      return [{ affectedRows: 1 }];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.updateJournalAndOptions(5, { type: 'Book' }, { journal_name: 'New Book' });

    const insert = connection.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('INSERT INTO journal_options'),
    );
    expect(String(insert[0]).replace(/\s+/g, ' ')).toContain('is_placeholder');
  });
});

describe('journal author payload identifies students', () => {
  it('returns the register number separately from a faculty ERP id', async () => {
    db.query.mockResolvedValue([[]]);

    await journalModel.getAuthors(9);

    // v_authors reports a student's register number in erp_id, the same slot a faculty ERP
    // id uses. Without a distinct student_id/student_ref the form classified every student
    // as faculty, and the next save asked for a faculty member with that register number.
    const [sql] = collectSql();
    expect(sql).toContain('v.student_ref');
    expect(sql).toContain('AS student_id');
  });

  it('includes the same student fields in the full journal payload', async () => {
    db.query.mockResolvedValue([[{ id: 1 }]]);

    await journalModel.getCompleteJournalDetails(9);

    const authorSql = collectSql().find((sql) => sql.includes('FROM v_authors v'));
    expect(authorSql).toContain('v.student_ref');
    expect(authorSql).toContain('AS student_id');
  });
});

describe('journal ownership', () => {
  it('records who submitted the publication', async () => {
    const connection = createFakeConnection((sql) => {
      if (sql.includes('SELECT id FROM journal_options WHERE id = ?')) return [[{ id: 3 }]];
      if (sql.includes('SELECT category FROM journal_options')) return [[{ category: 'National' }]];
      if (sql.startsWith('INSERT INTO journals SET')) return [{ insertId: 90 }];
      if (sql.includes('FROM journals j')) return [[{ id: 90 }]];
      return [[]];
    });
    db.getConnection.mockResolvedValue(connection);

    await journalModel.create({
      title: 'x',
      type: 'Article',
      journal_options_id: 3,
      created_by: 42,
      acknowledgement: {},
      author_affiliation: [],
    });

    const insert = connection.query.mock.calls.find(([sql]) =>
      String(sql).startsWith('INSERT INTO journals SET'),
    );
    expect(insert[1][0].created_by).toBe(42);
  });

  it('lets the submitter manage the record even when the paper credits other people', async () => {
    // Access used to be inferred from authorship alone, so filing a paper without
    // crediting yourself lost you the record: edits, deletes and index changes all 403'd
    // and it never appeared in your publication space.
    db.query.mockResolvedValue([
      [{ id: 9, status: 'waiting', admin_approval_status: 'pending', is_author: 0, is_creator: 1 }],
    ]);

    const access = await journalModel.getJournalWorkflowAccess(9, 42, 'submitter@example.test');

    expect(access.is_author).toBe(false);
    expect(access.is_creator).toBe(true);
    expect(access.can_manage).toBe(true);
  });

  it('still admits a credited author who did not file the submission', async () => {
    db.query.mockResolvedValue([
      [{ id: 9, status: 'waiting', admin_approval_status: 'pending', is_author: 1, is_creator: 0 }],
    ]);

    const access = await journalModel.getJournalWorkflowAccess(9, 7, 'author@example.test');

    expect(access.can_manage).toBe(true);
  });

  it('admits nobody who is neither the author nor the submitter', async () => {
    db.query.mockResolvedValue([
      [{ id: 9, status: 'waiting', admin_approval_status: 'pending', is_author: 0, is_creator: 0 }],
    ]);

    const access = await journalModel.getJournalWorkflowAccess(9, 999, 'stranger@example.test');

    expect(access.can_manage).toBe(false);
  });
});
