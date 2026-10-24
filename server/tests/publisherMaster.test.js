/**
 * Conference, Book and Book Chapter publishers moved from free text to the `publishers`
 * master. These pin the contracts that keep it clean: one row per name however it is
 * spelt, a user's own add usable before review, a rejected name staying rejected, a
 * saved record's name always coming from the master row its id points at, and the
 * review screen staying behind the form-options permissions.
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

vi.mock('../modules/notification/notificationService.js', () => ({
  default: { emit: vi.fn() },
  emit: vi.fn(),
}));

const db = (await import('../config/connection.js')).default;
const { default: accessControlModel } =
  await import('../modules/accessControl/accessControlModel.js');
const { default: journalModel } = await import('../modules/journal/journalModel.js');
const { default: formOptionsModel } = await import('../modules/formOptions/formOptionsModel.js');
const { normalizePublisherName } = await import('../modules/shared/publishers.js');
const { default: notificationService } =
  await import('../modules/notification/notificationService.js');
const { default: app } = await import('../server.js');

const collapse = (sql) => String(sql).replace(/\s+/g, ' ');

const snapshot = (permissions, extra = {}) => ({
  roles: ['faculty'],
  permissions,
  isAdmin: false,
  isSuperAdmin: false,
  ...extra,
});

let token;

beforeEach(() => {
  vi.restoreAllMocks();
  db.query.mockReset();
  accessControlModel.getUserAuthorizationSnapshot.mockReset();
  notificationService.emit.mockReset();
  token = jwt.sign(
    { userId: 5, email: 'faculty@ksrct.ac.in', name: 'Ordinary User', roles: ['faculty'] },
    process.env.JWT_SECRET,
  );
});

describe('normalizePublisherName', () => {
  it('trims and collapses whitespace, which the NO PAD unique key would otherwise miss', () => {
    expect(normalizePublisherName('  Springer   Nature ')).toBe('Springer Nature');
    expect(normalizePublisherName(undefined)).toBe('');
  });
});

describe('journalModel publisher picker', () => {
  it("offers approved publishers plus only the requester's own pending ones", async () => {
    db.query.mockResolvedValueOnce([[]]);

    await journalModel.searchPublishers('spring', 5);

    const [sql, params] = db.query.mock.calls[0];
    expect(collapse(sql)).toContain(
      "(status = 'approved' OR (status = 'pending' AND requested_by = ?))",
    );
    expect(params).toEqual([5, '%spring%', 25]);
  });

  it('returns the existing row when the name is already in the master', async () => {
    db.query.mockResolvedValueOnce([[{ id: 3, name: 'Elsevier', status: 'approved' }]]);

    const result = await journalModel.requestPublisher('ELSEVIER', 5);

    expect(result).toEqual({
      publisher: { id: 3, name: 'Elsevier', status: 'approved' },
      created: false,
    });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('refuses a name an administrator rejected', async () => {
    db.query.mockResolvedValueOnce([[{ id: 4, name: 'Predatory Press', status: 'rejected' }]]);

    await expect(journalModel.requestPublisher('Predatory Press', 5)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('adds a new name as pending, owned by the requester', async () => {
    db.query.mockResolvedValueOnce([[]]).mockResolvedValueOnce([{ insertId: 9 }]);

    const result = await journalModel.requestPublisher('New House', 5);

    expect(result).toEqual({
      publisher: { id: 9, name: 'New House', status: 'pending' },
      created: true,
    });
    const [sql, params] = db.query.mock.calls[1];
    expect(collapse(sql)).toContain("VALUES (?, 'pending', ?)");
    expect(params).toEqual(['New House', 5]);
  });
});

describe('POST /api/publishers', () => {
  it('lets any signed-in user add a publisher (no publications permission needed)', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot([]));
    vi.spyOn(journalModel, 'requestPublisher').mockResolvedValue({
      publisher: { id: 9, name: 'New House', status: 'pending' },
      created: true,
    });

    const response = await request(app)
      .post('/api/publishers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '  New   House ' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ success: true, data: { id: 9, status: 'pending' } });
    expect(journalModel.requestPublisher).toHaveBeenCalledWith('New House', 5);
    // A new entry is what reviewers are told about, so it does not sit unseen.
    expect(notificationService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'journal.publisher_requested',
        subject: expect.objectContaining({ recordId: 9, name: 'New House' }),
      }),
    );
  });

  it('tells nobody when the name already existed and was simply selected', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot([]));
    vi.spyOn(journalModel, 'requestPublisher').mockResolvedValue({
      publisher: { id: 3, name: 'Elsevier', status: 'approved' },
      created: false,
    });

    const response = await request(app)
      .post('/api/publishers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'elsevier' });

    expect(response.status).toBe(200);
    expect(notificationService.emit).not.toHaveBeenCalled();
  });

  it('rejects a blank name before touching the database', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot([]));
    vi.spyOn(journalModel, 'requestPublisher');

    const response = await request(app)
      .post('/api/publishers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(journalModel.requestPublisher).not.toHaveBeenCalled();
  });

  it('refuses an anonymous caller', async () => {
    const response = await request(app).post('/api/publishers').send({ name: 'X' });
    expect(response.status).toBe(401);
  });
});

describe('saving a publication linked to a publisher', () => {
  const bookPayload = (publicationDetails) => ({
    title: 'A Book',
    type: 'Book',
    category: 'National',
    acknowledgement: {},
    author_affiliation: [],
    publication_details: publicationDetails,
  });

  it("stores the master row's name, not the name the request sent", async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot([]));
    vi.spyOn(journalModel, 'getPublisherById').mockResolvedValue({
      id: 3,
      name: 'Elsevier',
      status: 'approved',
    });
    vi.spyOn(journalModel, 'create').mockResolvedValue({ id: 77, title: 'A Book' });

    const response = await request(app)
      .post('/api/journals')
      .set('Authorization', `Bearer ${token}`)
      .send(bookPayload({ publisher_id: 3, publisher: 'Somebody Else', print_isbn: '123' }));

    expect(response.status).toBe(201);
    expect(journalModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        publication_details: { publisher_id: 3, publisher: 'Elsevier', print_isbn: '123' },
      }),
    );
  });

  it('refuses a publisher id that does not exist', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot([]));
    vi.spyOn(journalModel, 'getPublisherById').mockResolvedValue(null);
    vi.spyOn(journalModel, 'create');

    const response = await request(app)
      .post('/api/journals')
      .set('Authorization', `Bearer ${token}`)
      .send(bookPayload({ publisher_id: 999, publisher: 'Ghost' }));

    expect(response.status).toBe(400);
    expect(journalModel.create).not.toHaveBeenCalled();
  });

  it('passes a record filed before the master existed (no publisher_id) through untouched', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot([]));
    vi.spyOn(journalModel, 'getPublisherById');
    vi.spyOn(journalModel, 'create').mockResolvedValue({ id: 78, title: 'A Book' });

    const response = await request(app)
      .post('/api/journals')
      .set('Authorization', `Bearer ${token}`)
      .send(bookPayload({ publisher: 'Old Free Text' }));

    expect(response.status).toBe(201);
    expect(journalModel.getPublisherById).not.toHaveBeenCalled();
    expect(journalModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ publication_details: { publisher: 'Old Free Text' } }),
    );
  });
});

/**
 * Greptile on PR #85: the save only checked that the publisher row existed, so a picker
 * opened before an admin rejected a publisher could still link a new record to it. A new
 * or changed link to a rejected publisher is refused; a record already linked keeps it.
 */
describe('linking a rejected publisher', () => {
  const rejected = { id: 4, name: 'Predatory Press', status: 'rejected' };
  const conferencePayload = (publisherId) => ({
    title: 'A paper',
    type: 'Conference paper',
    category: 'National',
    journal_name: 'Conf',
    acknowledgement: {},
    author_affiliation: [],
    publication_details: { conference_title: 'Conf', publisher_id: publisherId },
  });
  const allowEdit = () => {
    vi.spyOn(journalModel, 'getJournalWorkflowAccess').mockResolvedValue({
      can_manage: true,
      admin_approval_status: 'pending',
      edit_request_status: 'none',
    });
    vi.spyOn(journalModel, 'updateJournalAndOptions').mockResolvedValue({ success: true });
  };

  it('refuses it on a new publication', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot([]));
    vi.spyOn(journalModel, 'getPublisherById').mockResolvedValue(rejected);
    vi.spyOn(journalModel, 'create');

    const response = await request(app)
      .post('/api/journals')
      .set('Authorization', `Bearer ${token}`)
      .send(conferencePayload(4));

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('rejected');
    expect(journalModel.create).not.toHaveBeenCalled();
  });

  it('refuses switching an existing publication to it', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot([]));
    allowEdit();
    vi.spyOn(journalModel, 'getLinkedPublisherId').mockResolvedValue(3);
    vi.spyOn(journalModel, 'getPublisherById').mockResolvedValue(rejected);

    const response = await request(app)
      .put('/api/journals/77')
      .set('Authorization', `Bearer ${token}`)
      .send(conferencePayload(4));

    expect(response.status).toBe(400);
    expect(journalModel.updateJournalAndOptions).not.toHaveBeenCalled();
  });

  it('lets a publication already linked to it be saved again', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot([]));
    allowEdit();
    vi.spyOn(journalModel, 'getLinkedPublisherId').mockResolvedValue(4);
    vi.spyOn(journalModel, 'getPublisherById').mockResolvedValue(rejected);

    const response = await request(app)
      .put('/api/journals/77')
      .set('Authorization', `Bearer ${token}`)
      .send(conferencePayload(4));

    expect(response.status).toBe(200);
    expect(journalModel.updateJournalAndOptions).toHaveBeenCalled();
  });
});

describe('admin publisher review (/api/form-options/publishers)', () => {
  it('is closed to a signed-in user who is not an admin', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(snapshot([]));
    vi.spyOn(formOptionsModel, 'getPublishers');

    const response = await request(app)
      .get('/api/form-options/publishers')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(formOptionsModel.getPublishers).not.toHaveBeenCalled();
  });

  it('lets an admin with form_options.read list, but not approve', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(
      snapshot(['form_options.read'], { isAdmin: true }),
    );
    vi.spyOn(formOptionsModel, 'getPublishers').mockResolvedValue([]);
    vi.spyOn(formOptionsModel, 'updatePublisher');

    const list = await request(app)
      .get('/api/form-options/publishers')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toEqual({ success: true, data: [] });

    const approve = await request(app)
      .put('/api/form-options/publishers/9')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New House', status: 'approved' });
    expect(approve.status).toBe(403);
    expect(formOptionsModel.updatePublisher).not.toHaveBeenCalled();
  });

  it('lets an admin with form_options.edit approve, stamping the reviewer', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(
      snapshot(['form_options.edit'], { isAdmin: true }),
    );
    vi.spyOn(formOptionsModel, 'updatePublisher').mockResolvedValue(true);

    const response = await request(app)
      .put('/api/form-options/publishers/9')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: ' New House ', status: 'approved' });

    expect(response.status).toBe(200);
    expect(formOptionsModel.updatePublisher).toHaveBeenCalledWith(
      '9',
      { name: 'New House', status: 'approved' },
      5,
    );
  });

  it('rejects an unknown status', async () => {
    accessControlModel.getUserAuthorizationSnapshot.mockResolvedValue(
      snapshot(['form_options.edit'], { isAdmin: true }),
    );
    vi.spyOn(formOptionsModel, 'updatePublisher');

    const response = await request(app)
      .put('/api/form-options/publishers/9')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New House', status: 'deleted' });

    expect(response.status).toBe(400);
    expect(formOptionsModel.updatePublisher).not.toHaveBeenCalled();
  });
});

describe('formOptionsModel publisher writes', () => {
  it('stamps the reviewer only when the status changes, before status is overwritten', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await formOptionsModel.updatePublisher(9, { name: 'New House', status: 'approved' }, 5);

    const [sql, params] = db.query.mock.calls[0];
    const flat = collapse(sql);
    // SET runs left to right: the stamps must read the old status.
    expect(flat).toContain('reviewed_by = IF(status <> ?, ?, reviewed_by)');
    expect(flat.indexOf('reviewed_at')).toBeLessThan(flat.lastIndexOf('status = ?'));
    expect(params).toEqual(['approved', 5, 'approved', 'New House', 'approved', 9]);
  });

  it('refuses to delete a publisher a publication links to', async () => {
    db.query.mockResolvedValueOnce([[{ references_count: 2 }]]);

    await expect(formOptionsModel.deletePublisher(9)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('counts references with a numeric id, since the route hands it over as a string', async () => {
    // MySQL compares JSON 5 with '5' as unequal: a string id counted no references and
    // deleted a publisher that a saved record still pointed at.
    db.query.mockResolvedValueOnce([[{ references_count: 1 }]]);

    await expect(formOptionsModel.deletePublisher('5')).rejects.toMatchObject({ statusCode: 409 });
    expect(db.query.mock.calls[0][1]).toEqual([5]);
  });

  it('deletes a publisher nothing links to', async () => {
    db.query
      .mockResolvedValueOnce([[{ references_count: 0 }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    expect(await formOptionsModel.deletePublisher(9)).toBe(true);
    expect(collapse(db.query.mock.calls[1][0])).toContain('DELETE FROM publishers');
  });
});
