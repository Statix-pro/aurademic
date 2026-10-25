/**
 * Staff Scopus Author IDs decide who is credited with imported papers, so these pin the rules
 * that keep a credit honest: an ID on file for one person is never moved to another, a staff
 * member can only claim a profile suggested for them by name and held by nobody, a claim is
 * made for the caller's own record and never one named in the request, an undo takes back
 * exactly what the ID credited, and only a super admin sees or removes IDs.
 */

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
const { readSourceFile } = await import('../modules/journalCatalog/importReader.js');
const { getSource } = await import('../modules/journalCatalog/sources.js');
const { planStaffIds } = await import('../modules/journalCatalog/staffIdPlanner.js');
const { scopusNameMatches } = await import('../modules/journalCatalog/values.js');
const { creditScopusIds, uncreditScopusId } =
  await import('../modules/journalCatalog/scopusCredit.js');
const { default: app } = await import('../server.js');

const collapse = (sql) => String(sql).replace(/\s+/g, ' ').trim();

const makeConnection = (respond) => ({
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  query: vi.fn(async (sql, params) => respond(collapse(sql), params)),
});

const token = (userId) => jwt.sign({ userId, roles: ['faculty'] }, process.env.JWT_SECRET);

const snapshot = ({ isSuperAdmin = false } = {}) => ({
  roles: isSuperAdmin ? ['super_admin'] : ['faculty'],
  permissions: [],
  isAdmin: isSuperAdmin,
  isSuperAdmin,
});

beforeEach(() => {
  vi.restoreAllMocks();
  db.query.mockReset();
  db.getConnection.mockReset();
  accessControlModel.getUserAuthorizationSnapshot.mockReset();
});

describe('reading a staff Scopus ID sheet', () => {
  const sheet = (rows) =>
    readSourceFile(
      getSource('staff_scopus_ids'),
      Buffer.from(['ERP ID,Scopus Author ID', ...rows].join('\n')),
    );

  it('takes several IDs in one cell, and a Scopus profile link for its ID', async () => {
    const { records } = await sheet([
      'KSR101,"57225844882; 58644325800"',
      'KSR102,https://www.scopus.com/authid/detail.uri?authorId=57190000001',
    ]);
    expect(records.map((record) => record.scopusIds)).toEqual([
      ['57225844882', '58644325800'],
      ['57190000001'],
    ]);
  });

  it('keeps a value that is not an ID for review, and leaves out a row with no ID', async () => {
    const { records, excluded } = await sheet(['KSR101,abc', 'KSR102,']);
    expect(records[0]).toMatchObject({ scopusIds: [], invalidIds: ['abc'] });
    expect(excluded).toEqual({ no_scopus_id: 1 });
  });
});

describe('planning a staff Scopus ID sheet', () => {
  const employees = [
    { id: 1, erp_id: 'KSR101', name: 'K Raja' },
    { id: 2, erp_id: 'KSR102', name: 'S Priya' },
  ];
  const plan = (
    records,
    { held = new Map(), conflicts = new Set(), unassigned = new Map() } = {},
  ) =>
    planStaffIds({
      records: records.map((record, index) => ({ invalidIds: [], line: index + 2, ...record })),
      employees,
      held,
      conflicts,
      unassigned,
    });

  it('adds a new ID and says how many imported papers it will credit', () => {
    const { rows, summary } = plan([{ erpId: 'ksr101', scopusIds: ['57225844882'] }], {
      unassigned: new Map([['57225844882', 12]]),
    });
    expect(rows[0]).toMatchObject({ outcome: 'add', journal_name: 'K Raja (ERP KSR101)' });
    expect(rows[0].changes).toContainEqual({ field: 'Papers credited', from: null, to: 12 });
    expect(summary.staff.papersToCredit).toBe(12);
  });

  it('never moves an ID on file for someone else', () => {
    const { rows } = plan([{ erpId: 'KSR102', scopusIds: ['57225844882'] }], {
      held: new Map([['57225844882', { id: 1, name: 'K Raja', erp_id: 'KSR101' }]]),
    });
    expect(rows[0].outcome).toBe('exception');
    expect(rows[0].reason).toMatch(/already on file for K Raja/);
  });

  it('reports an ID that is already the same person’s as no change', () => {
    const { rows } = plan([{ erpId: 'KSR101', scopusIds: ['57225844882'] }], {
      held: new Map([['57225844882', { id: 1, name: 'K Raja', erp_id: 'KSR101' }]]),
    });
    expect(rows[0].outcome).toBe('unchanged');
  });

  it('flags an unknown ERP ID and one ID given for two people in the same sheet', () => {
    const { rows } = plan([
      { erpId: 'NOPE', scopusIds: ['57225844882'] },
      { erpId: 'KSR101', scopusIds: ['58644325800'] },
      { erpId: 'KSR102', scopusIds: ['58644325800'] },
    ]);
    expect(rows[0].reason).toMatch(/No staff member has ERP ID "NOPE"/);
    expect(rows[1].outcome).toBe('add');
    expect(rows[2].reason).toMatch(/also given on line 3/);
  });
});

describe('suggesting Scopus profiles by name', () => {
  it.each([
    ['K Raja', 'Raja, K.'],
    ['Muthusamy Senthilkumar', 'Senthilkumar, M.'],
    ['M Senthilkumar', 'Senthilkumar, Muthusamy'],
    ['Dr. M.S. Senthil Kumar', 'Senthil Kumar, M.S.'],
  ])('suggests %s for %s', (staff, scopus) => {
    expect(scopusNameMatches(staff, scopus)).toBe(true);
  });

  it.each([
    ['K Raja', 'Rajan, K.'],
    ['Senthil Kumar M', 'Kumar, S.'],
    ['Priya', 'Priya, S.'],
  ])('does not suggest %s for %s', (staff, scopus) => {
    expect(scopusNameMatches(staff, scopus)).toBe(false);
  });
});

describe('crediting and undoing', () => {
  it('credits the KSRCT positions an ID holds and takes them off the external list', async () => {
    const writes = [];
    const connection = makeConnection((sql, params) => {
      if (sql.startsWith('SELECT id, journal_id, author_position')) {
        return [[{ id: 1, journal_id: 500, author_position: 1, scopus_author_id: '5722' }]];
      }
      if (sql.startsWith('SELECT id FROM authors')) return [[{ id: 70 }]];
      if (sql.startsWith('SELECT id, external_details FROM journals')) {
        return [
          [
            {
              id: 500,
              external_details: JSON.stringify([
                { name: 'Raja, K.', scopus_author_id: '5722' },
                { name: 'Smith, J.', scopus_author_id: '1111' },
              ]),
            },
          ],
        ];
      }
      writes.push({ sql, params });
      return [{ affectedRows: 1 }];
    });

    const papers = await creditScopusIds(connection, 7, ['5722']);

    expect(papers).toBe(1);
    expect(collapse(connection.query.mock.calls[0][0])).toMatch(
      /is_ksrct = 1 AND employee_id IS NULL/,
    );
    expect(
      writes.find((write) => write.sql.startsWith('INSERT INTO author_journal')).params,
    ).toEqual([70, 500, 1]);
    const external = writes.find((write) => write.sql.startsWith('UPDATE journals SET external'));
    expect(JSON.parse(external.params[0])).toEqual([
      { name: 'Smith, J.', scopus_author_id: '1111' },
    ]);
  });

  const undo = async (positions, { remaining = [] } = {}) => {
    const writes = [];
    const connection = makeConnection((sql, params) => {
      if (sql.startsWith('SELECT s.id, s.journal_id')) return [positions];
      if (sql.startsWith('SELECT id, journal_id FROM journal_scopus_authors')) return [remaining];
      if (sql.startsWith('SELECT id FROM authors')) return [[{ id: 70 }]];
      if (sql.startsWith('SELECT external_details FROM journals')) {
        return [[{ external_details: null }]];
      }
      writes.push({ sql, params });
      return [{ affectedRows: 1 }];
    });
    await uncreditScopusId(connection, 7, '5722');
    return writes;
  };
  const position = (overrides) => ({
    id: 1,
    journal_id: 500,
    author_position: 2,
    author_name: 'Raja, K.',
    linked_by_import: 1,
    imported: 1,
    ...overrides,
  });

  it('takes the staff member off a paper the import created and lists them as external again', async () => {
    const writes = await undo([position()]);
    const deletes = writes.filter((write) => write.sql.startsWith('DELETE FROM author_journal'));
    expect(deletes.map((write) => write.params[0])).toEqual([500]);
    const restored = writes.find((write) => write.sql.startsWith('UPDATE journals SET external'));
    expect(JSON.parse(restored.params[0])).toEqual([
      expect.objectContaining({
        name: 'Raja, K.',
        scopus_author_id: '5722',
        is_first_author: false,
      }),
    ]);
  });

  it('keeps a credit someone gave on the form, even on a paper the import filled in', async () => {
    const writes = await undo([position({ linked_by_import: 0, imported: 0 })]);
    expect(writes.some((write) => write.sql.startsWith('DELETE FROM author_journal'))).toBe(false);
    expect(writes.some((write) => write.sql.startsWith('UPDATE journals SET external'))).toBe(
      false,
    );
  });

  it('takes back a credit the import added to a form-filed paper, without touching its author list', async () => {
    const writes = await undo([position({ linked_by_import: 1, imported: 0 })]);
    expect(
      writes.filter((write) => write.sql.startsWith('DELETE FROM author_journal')),
    ).toHaveLength(1);
    expect(writes.some((write) => write.sql.startsWith('UPDATE journals SET external'))).toBe(
      false,
    );
  });

  it('leaves the link to another of their Scopus IDs on the same paper, and hands it the flag', async () => {
    const writes = await undo([position()], { remaining: [{ id: 9, journal_id: 500 }] });
    expect(writes.some((write) => write.sql.startsWith('DELETE FROM author_journal'))).toBe(false);
    const handed = writes.find((write) => write.sql.includes('SET linked_by_import = 1'));
    expect(handed.params).toEqual([[9]]);
  });

  it('does not link a staff member twice when the form credited them through another author row', async () => {
    const writes = [];
    const connection = makeConnection((sql, params) => {
      if (sql.startsWith('SELECT id, journal_id, author_position')) {
        return [[{ id: 1, journal_id: 500, author_position: 1, scopus_author_id: '5722' }]];
      }
      if (sql.startsWith('SELECT id FROM authors')) return [[{ id: 12 }]];
      if (sql.startsWith('SELECT 1 FROM author_journal')) return [[{ 1: 1 }]];
      if (sql.startsWith('SELECT id, external_details FROM journals')) return [[]];
      writes.push({ sql, params });
      return [{ affectedRows: 1 }];
    });
    await creditScopusIds(connection, 7, ['5722']);
    expect(writes.some((write) => write.sql.startsWith('INSERT INTO author_journal'))).toBe(false);
    const mark = writes.find((write) => write.sql.startsWith('UPDATE journal_scopus_authors'));
    expect(mark.params).toEqual([7, 0, [1]]);
  });
});

describe('staff claiming their own profile', () => {
  beforeEach(() => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot());
  });

  it('requires sign-in', async () => {
    const response = await request(app).get('/api/scopus-profile');
    expect(response.status).toBe(401);
  });

  it('finds the staff record from the signed-in user, not from anything in the request', async () => {
    db.query.mockImplementation(async (sql) => {
      if (collapse(sql).includes('FROM users u JOIN master_employees e')) return [[]];
      return [[]];
    });
    const response = await request(app)
      .get('/api/scopus-profile?employeeId=1')
      .set('Authorization', `Bearer ${token(42)}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ staff: null, yours: [], suggestions: [] });
    const lookup = db.query.mock.calls.find(([sql]) => collapse(sql).includes('FROM users u'));
    expect(lookup[1]).toEqual([42]);
  });

  const claimConnection = ({ candidates }) => {
    const writes = [];
    const connection = makeConnection((sql, params) => {
      if (sql.includes('FROM users u JOIN master_employees e')) {
        return [[{ id: 7, erp_id: 'KSR101', scopus_id: null, name: 'K Raja' }]];
      }
      if (sql.startsWith('SELECT e.id, TRIM(e.scopus_id)')) {
        return [[{ id: 8, scopus_id: '11111111111', name: 'S Priya', erp_id: 'KSR102' }]];
      }
      if (sql.startsWith('SELECT e.id, x.scopus_author_id')) return [[]];
      if (
        sql.startsWith('SELECT CAST(scopus_author_id AS CHAR) AS scopus_author_id, author_name')
      ) {
        return [candidates];
      }
      if (sql.startsWith('SELECT id, journal_id, author_position')) return [[]];
      writes.push({ sql, params });
      return [{ affectedRows: 1 }];
    });
    db.getConnection.mockResolvedValue(connection);
    return { connection, writes };
  };

  it('adds a suggested profile to the caller and credits it at once', async () => {
    const { writes, connection } = claimConnection({
      candidates: [{ scopus_author_id: '57225844882', author_name: 'Raja, K.', papers: 4 }],
    });
    const response = await request(app)
      .post('/api/scopus-profile/claims')
      .set('Authorization', `Bearer ${token(42)}`)
      .send({ scopusAuthorId: '57225844882', employeeId: 8 });

    expect(response.status).toBe(201);
    expect(connection.commit).toHaveBeenCalled();
    const insert = writes.find((write) => write.sql.startsWith('INSERT INTO employee_scopus_ids'));
    expect(insert.params).toEqual([7, '57225844882', 42]);
  });

  it('answers a claim lost to someone confirming the same profile at once with 409, not 500', async () => {
    const { connection } = claimConnection({
      candidates: [{ scopus_author_id: '57225844882', author_name: 'Raja, K.', papers: 4 }],
    });
    const respond = connection.query.getMockImplementation();
    connection.query.mockImplementation(async (sql, params) => {
      if (collapse(sql).startsWith('INSERT INTO employee_scopus_ids')) {
        throw Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });
      }
      return respond(sql, params);
    });
    const response = await request(app)
      .post('/api/scopus-profile/claims')
      .set('Authorization', `Bearer ${token(42)}`)
      .send({ scopusAuthorId: '57225844882' });
    expect(response.status).toBe(409);
    expect(connection.rollback).toHaveBeenCalled();
  });

  it('refuses a profile held by someone else or not suggested by name', async () => {
    for (const [id, name] of [
      ['11111111111', 'Raja, K.'],
      ['57225844882', 'Kumar, S.'],
    ]) {
      const { writes, connection } = claimConnection({
        candidates: [{ scopus_author_id: id, author_name: name, papers: 4 }],
      });
      const response = await request(app)
        .post('/api/scopus-profile/claims')
        .set('Authorization', `Bearer ${token(42)}`)
        .send({ scopusAuthorId: id });

      expect(response.status).toBe(409);
      expect(connection.rollback).toHaveBeenCalled();
      expect(writes).toHaveLength(0);
    }
  });
});

describe('the Scopus ID list', () => {
  it('is for a super admin only', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot());
    const list = await request(app)
      .get('/api/journal-catalog/scopus-ids')
      .set('Authorization', `Bearer ${token(42)}`);
    const remove = await request(app)
      .delete('/api/journal-catalog/scopus-ids/1')
      .set('Authorization', `Bearer ${token(42)}`);

    expect(list.status).toBe(403);
    expect(remove.status).toBe(403);
    expect(db.getConnection).not.toHaveBeenCalled();
  });
});
