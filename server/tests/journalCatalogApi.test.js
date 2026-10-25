/**
 * The journal-list import writes to a table every publication reads, so these pin its
 * contracts at the edges: only a super admin reaches it (it is a data-maintenance tool, not a
 * screen any role permission opens), an
 * uploaded file never touches disk (it carries staff names, and `uploads/` is served
 * publicly), an apply is all-or-nothing and never runs twice, and accepting exceptions either
 * applies every selected row or none.
 */

import fs from 'fs';
import path from 'path';

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key';

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn(), query: vi.fn(), execute: vi.fn() },
}));

vi.mock('../modules/accessControl/accessControlModel.js', () => ({
  default: { getUserAuthorizationSnapshot: vi.fn() },
}));

const db = (await import('../config/connection.js')).default;
const { default: accessControlModel } =
  await import('../modules/accessControl/accessControlModel.js');
const { default: journalCatalogModel } =
  await import('../modules/journalCatalog/journalCatalogModel.js');
const { default: app } = await import('../server.js');

const collapse = (sql) => String(sql).replace(/\s+/g, ' ').trim();

const snapshot = (permissions, { isAdmin = true, isSuperAdmin = false } = {}) => ({
  roles: isSuperAdmin ? ['super_admin'] : isAdmin ? ['admin'] : ['faculty'],
  permissions,
  isAdmin,
  isSuperAdmin,
});

const superAdmin = () => snapshot([], { isSuperAdmin: true });

const token = jwt.sign({ userId: 9, roles: ['admin'] }, process.env.JWT_SECRET);
const auth = (req) => req.set('Authorization', `Bearer ${token}`);

const SCIMAGO = Buffer.from(
  [
    'Rank;Sourceid;Title;Type;Issn;SJR;SJR Best Quartile;H index;Total Docs. (2025);Country',
    '1;21100000001;"3 Biotech";journal;"2190572X";0,9;Q2;40;100;Germany',
  ].join('\n'),
);

/** A fake pooled connection whose `query` answers by matching the SQL text. */
const makeConnection = (respond) => ({
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  query: vi.fn(async (sql, params) => respond(collapse(sql), params)),
});

const tempUploads = () => {
  const dir = path.join(process.cwd(), 'uploads', 'temp');
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
};

beforeEach(() => {
  vi.restoreAllMocks();
  db.query.mockReset();
  db.getConnection.mockReset();
  accessControlModel.getUserAuthorizationSnapshot.mockReset();
});

describe('access', () => {
  it('requires a signed-in user', async () => {
    const response = await request(app).get('/api/journal-catalog/sources');
    expect(response.status).toBe(401);
  });

  it('refuses a signed-in user who is not an admin', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(
      snapshot(['form_options.manage'], { isAdmin: false }),
    );
    const response = await auth(request(app).get('/api/journal-catalog/sources'));
    expect(response.status).toBe(403);
  });

  it('refuses an admin even with every form-options permission', async () => {
    // Journal Management is a form-options screen; this import is not — a role permission
    // must never open it.
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(
      snapshot(['form_options.read', 'form_options.edit', 'form_options.manage']),
    );

    const read = await auth(request(app).get('/api/journal-catalog/journals'));
    const write = await auth(
      request(app).post('/api/journal-catalog/imports/scimago/preview'),
    ).attach('file', SCIMAGO, 'scimagojr 2025.csv');

    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
  });

  it('lets a super admin in', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(superAdmin());
    const response = await auth(request(app).get('/api/journal-catalog/sources'));
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});

describe('preview upload', () => {
  beforeEach(() => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(superAdmin());
  });

  it('refuses a file type it does not read, in the envelope', async () => {
    const response = await auth(
      request(app).post('/api/journal-catalog/imports/scimago/preview'),
    ).attach('file', Buffer.from('%PDF'), 'list.pdf');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false });
  });

  it('answers 404 for an unknown source', async () => {
    const response = await auth(
      request(app).post('/api/journal-catalog/imports/nope/preview'),
    ).attach('file', SCIMAGO, 'x.csv');
    expect(response.status).toBe(404);
  });

  it('plans against the list, stores only the plan, and never writes the file to disk', async () => {
    const before = tempUploads();
    vi.spyOn(journalCatalogModel, 'loadJournalSnapshot').mockResolvedValue([
      {
        id: 4,
        journal_name: '3 Biotech',
        print_issn: '2190-572X',
        online_issn: '',
        publisher: '',
        is_placeholder: 0,
        metrics: {},
      },
    ]);
    vi.spyOn(journalCatalogModel, 'findAppliedBatch').mockResolvedValue(null);
    const create = vi.spyOn(journalCatalogModel, 'createPreviewBatch').mockResolvedValue(31);
    vi.spyOn(journalCatalogModel, 'getBatch').mockResolvedValue({ id: 31, status: 'previewed' });

    const response = await auth(
      request(app).post('/api/journal-catalog/imports/scimago/preview'),
    ).attach('file', SCIMAGO, 'scimagojr 2025.csv');

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ success: true, data: { id: 31 } });
    const stored = create.mock.calls[0][0];
    expect(stored).toMatchObject({ sourceKey: 'scimago', metricYear: 2025, userId: 9 });
    expect(stored.summary.outcomes.update).toBe(1);
    expect(stored.rows[0].payload.metrics).toContainEqual({
      metric: 'quartile',
      metric_year: 2025,
      source: 'scimago',
      value_text: 'Q2',
    });
    expect(tempUploads()).toEqual(before);
  });

  it('names an earlier import of the same file but still previews it', async () => {
    // Re-applying a reference file is how journals added by a later export get their
    // quartile, so a repeat is reported rather than refused.
    const appliedAt = '2026-10-25T06:00:00.000Z';
    vi.spyOn(journalCatalogModel, 'loadJournalSnapshot').mockResolvedValue([]);
    vi.spyOn(journalCatalogModel, 'findAppliedBatch').mockResolvedValue({
      id: 7,
      applied_at: appliedAt,
    });
    const create = vi.spyOn(journalCatalogModel, 'createPreviewBatch').mockResolvedValue(32);
    vi.spyOn(journalCatalogModel, 'getBatch').mockResolvedValue({ id: 32, status: 'previewed' });

    const response = await auth(
      request(app).post('/api/journal-catalog/imports/scimago/preview'),
    ).attach('file', SCIMAGO, 'scimagojr 2025.csv');

    expect(response.status).toBe(201);
    expect(create.mock.calls[0][0].summary.previouslyApplied).toEqual({ id: 7, appliedAt });
  });
});

describe('journalCatalogModel.applyBatch', () => {
  const addRow = {
    id: 501,
    outcome: 'add',
    journal_option_id: null,
    payload: {
      action: 'add',
      issns: ['2190572X'],
      create: { journal_name: '3 Biotech', print_issn: '2190-572X', category: 'International' },
      metrics: [],
    },
  };

  const respondWith =
    ({ batch, journals = [], rows = [], failOn }) =>
    (sql) => {
      if (failOn && sql.startsWith(failOn)) throw new Error('database went away');
      if (sql.startsWith('SELECT id, status FROM journal_import_batches')) return [[batch]];
      if (sql.startsWith('SELECT id, journal_name, publisher')) return [journals];
      if (sql.startsWith('SELECT journal_option_id, metric')) return [[]];
      if (sql.startsWith('SELECT id, outcome, journal_option_id, payload')) return [rows];
      if (sql.startsWith('INSERT INTO journal_options')) return [{ insertId: 77 }];
      return [{ affectedRows: 1 }];
    };

  it('refuses an import that is no longer a preview, changing nothing', async () => {
    const connection = makeConnection(respondWith({ batch: { id: 3, status: 'applied' } }));
    db.getConnection.mockResolvedValue(connection);

    await expect(journalCatalogModel.applyBatch(3, 9)).rejects.toMatchObject({ statusCode: 409 });
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  it('turns an add whose ISSN has since been taken into an exception instead of a duplicate', async () => {
    const connection = makeConnection(
      respondWith({
        batch: { id: 3, status: 'previewed', source_key: 'ksrct_master', file_sha256: 'a' },
        journals: [
          { id: 12, journal_name: '3 Biotech', print_issn: '2190-572X', is_placeholder: 0 },
        ],
        rows: [addRow],
      }),
    );
    db.getConnection.mockResolvedValue(connection);

    const result = await journalCatalogModel.applyBatch(3, 9);

    expect(result).toEqual({ added: 0, updated: 0, unchanged: 0, notApplied: 1 });
    const sqls = connection.query.mock.calls.map(([sql]) => collapse(sql));
    expect(sqls.some((sql) => sql.startsWith('INSERT INTO journal_options'))).toBe(false);
    expect(sqls).toContain(
      "UPDATE journal_import_rows SET outcome = 'exception', reason = ? WHERE id = ?",
    );
    expect(connection.commit).toHaveBeenCalled();
  });

  it('rolls the whole import back when a write fails part-way', async () => {
    const connection = makeConnection(
      respondWith({
        batch: { id: 3, status: 'previewed', source_key: 'ksrct_master', file_sha256: 'a' },
        rows: [addRow],
        failOn: 'UPDATE journal_import_batches',
      }),
    );
    db.getConnection.mockResolvedValue(connection);

    await expect(journalCatalogModel.applyBatch(3, 9)).rejects.toThrow('database went away');
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  it('leaves the Impact Factor alone when the file carried none', async () => {
    // A SCImago apply used to re-derive impact_factor from older yearly rows, undoing a newer
    // value an admin had typed in Journal Management.
    const scimagoRow = {
      id: 502,
      outcome: 'update',
      journal_option_id: 12,
      payload: {
        action: 'update',
        journalOptionId: 12,
        issns: ['2190572X'],
        set: [],
        metrics: [{ metric: 'quartile', metric_year: 2025, source: 'scimago', value_text: 'Q1' }],
      },
    };
    const connection = makeConnection(
      respondWith({
        batch: { id: 4, status: 'previewed' },
        journals: [
          { id: 12, journal_name: '3 Biotech', print_issn: '2190-572X', is_placeholder: 0 },
        ],
        rows: [scimagoRow],
      }),
    );
    db.getConnection.mockResolvedValue(connection);

    await journalCatalogModel.applyBatch(4, 9);

    const sqls = connection.query.mock.calls.map(([sql]) => collapse(sql));
    expect(sqls.some((sql) => sql.startsWith('INSERT INTO journal_metrics_yearly'))).toBe(true);
    expect(sqls.some((sql) => sql.startsWith('UPDATE journal_options jo SET'))).toBe(false);
  });

  it('refreshes only the metric a file wrote', async () => {
    const masterRow = {
      id: 503,
      outcome: 'update',
      journal_option_id: 12,
      payload: {
        action: 'update',
        journalOptionId: 12,
        issns: ['2190572X'],
        set: [],
        metrics: [
          {
            metric: 'impact_factor',
            metric_year: 2024,
            source: 'faculty_master',
            value_decimal: 2.9,
          },
        ],
      },
    };
    const connection = makeConnection(
      respondWith({
        batch: { id: 5, status: 'previewed' },
        journals: [
          { id: 12, journal_name: '3 Biotech', print_issn: '2190-572X', is_placeholder: 0 },
        ],
        rows: [masterRow],
      }),
    );
    db.getConnection.mockResolvedValue(connection);

    await journalCatalogModel.applyBatch(5, 9);

    const refreshes = connection.query.mock.calls
      .map(([sql, params]) => ({ sql: collapse(sql), params }))
      .filter((call) => call.sql.startsWith('UPDATE journal_options jo SET'));
    expect(refreshes).toHaveLength(1);
    expect(refreshes[0].sql).toContain('SET impact_factor = COALESCE');
    expect(refreshes[0].params).toEqual([
      'impact_factor',
      ['faculty_master', 'faculty_entry', 'admin', 'jcr'],
      [12],
    ]);
  });
});

describe('journalCatalogModel.listJournals', () => {
  it('compares ISSNs only for text that is an ISSN', async () => {
    // A name reduced to '' for the ISSN match, and '' equals every journal stored without an
    // ISSN — searching "Energy" listed them all.
    db.query.mockResolvedValue([[{ total: 0 }]]);

    await journalCatalogModel.listJournals({ search: 'Energy', page: 1, perPage: 25 });
    const nameSearch = collapse(db.query.mock.calls[0][0]);
    expect(nameSearch).not.toContain('REPLACE(jo.print_issn');
    expect(db.query.mock.calls[0][1]).toEqual(['%Energy%']);

    db.query.mockClear();
    await journalCatalogModel.listJournals({ search: '2190-572X', page: 1, perPage: 25 });
    expect(db.query.mock.calls[0][1]).toEqual(['%2190-572X%', '2190572X', '2190572X']);
  });
});

describe('journalCatalogModel.resolveExceptions', () => {
  it('accepts all selected rows or none: one that can no longer apply rolls back the rest', async () => {
    const payload = (name, issn) => ({
      action: 'add',
      issns: [issn],
      create: { journal_name: name, print_issn: `${issn.slice(0, 4)}-${issn.slice(4)}` },
      metrics: [],
    });
    const connection = makeConnection((sql) => {
      if (sql.startsWith('SELECT id, status FROM journal_import_batches'))
        return [[{ id: 3, status: 'applied' }]];
      if (sql.startsWith('SELECT id, journal_name, payload FROM journal_import_rows')) {
        return [
          [
            { id: 1, journal_name: 'Fresh Journal', payload: payload('Fresh Journal', '00181390') },
            { id: 2, journal_name: '3 Biotech', payload: payload('3 Biotech', '2190572X') },
          ],
        ];
      }
      if (sql.startsWith('SELECT id, journal_name, publisher')) {
        return [
          [{ id: 12, journal_name: '3 Biotech', print_issn: '2190-572X', is_placeholder: 0 }],
        ];
      }
      if (sql.startsWith('SELECT journal_option_id, metric')) return [[]];
      if (sql.startsWith('INSERT INTO journal_options')) return [{ insertId: 80 }];
      return [{ affectedRows: 1 }];
    });
    db.getConnection.mockResolvedValue(connection);

    const attempt = journalCatalogModel.resolveExceptions(
      3,
      { rowIds: [1, 2], action: 'accept' },
      9,
    );

    await expect(attempt).rejects.toMatchObject({
      statusCode: 409,
      details: [
        { rowId: 2, journalName: '3 Biotech', reason: expect.stringContaining('2190-572X') },
      ],
    });
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
  });

  it('will not resolve exceptions before the import itself is applied', async () => {
    const connection = makeConnection(() => [[{ id: 3, status: 'previewed' }]]);
    db.getConnection.mockResolvedValue(connection);

    await expect(
      journalCatalogModel.resolveExceptions(3, { rowIds: [1], action: 'exclude' }, 9),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(connection.rollback).toHaveBeenCalled();
  });
});

describe('resolving exceptions over the API', () => {
  it('answers a malformed request with 400, not a server error', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(superAdmin());
    db.query.mockResolvedValue([[{ source_key: 'ksrct_master' }]]);
    const send = (body) =>
      auth(request(app).post('/api/journal-catalog/imports/5/exceptions/resolve')).send(body);

    const notAList = await send({ action: 'accept', rowIds: '12' });
    const notFields = await send({ action: 'accept', rowIds: [12], overrides: { 12: null } });

    expect(notAList.status).toBe(400);
    expect(notFields.status).toBe(400);
    expect(notFields.body).toMatchObject({ success: false });
    expect(db.getConnection).not.toHaveBeenCalled();
  });
});

describe('publication form pickers', () => {
  // These searches were public: anyone who could reach the API read the journal list's
  // metrics and the staff directory. Both forms call them signed in.
  it.each(['/api/journals/search?query=biotech', '/api/authors/search?query=ravi'])(
    'refuses %s without a sign-in',
    async (url) => {
      const response = await request(app).get(url);
      expect(response.status).toBe(401);
    },
  );

  it('answers a signed-in user', async () => {
    db.query.mockResolvedValue([[]]);
    const response = await auth(request(app).get('/api/journals/search?query=biotech'));
    expect(response.status).toBe(200);
  });
});
