import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({ default: { execute: vi.fn(), query: vi.fn() } }));

const db = (await import('../config/connection.js')).default;
const { default: journalModel } = await import('../modules/journal/journalModel.js');
const { default: journalController } = await import('../modules/journal/journalController.js');

const response = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

beforeEach(() => {
  db.execute.mockReset();
});

/**
 * A student author is not in the employee master, so the journal form stores
 * their department by name, picked from this list. Only active departments are
 * offered, alphabetically, and only the id and name leave the server.
 */
describe('journal departments', () => {
  it('lists only active departments, by name', async () => {
    db.execute.mockResolvedValueOnce([[{ id: 3, name: 'Food Technology' }]]);

    expect(await journalModel.listDepartments()).toEqual([{ id: 3, name: 'Food Technology' }]);
    const [sql] = db.execute.mock.calls[0];
    expect(sql).toMatch(/SELECT id, name FROM master_departments/);
    expect(sql).toMatch(/is_active = 1/);
    expect(sql).toMatch(/ORDER BY name/);
  });

  it('answers in the success envelope', async () => {
    db.execute.mockResolvedValueOnce([[{ id: 1, name: 'Civil Engineering' }]]);
    const res = response();

    await journalController.listDepartments({}, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 1, name: 'Civil Engineering' }],
    });
  });

  it('answers a failure in the envelope too', async () => {
    db.execute.mockRejectedValueOnce(new Error('pool exhausted'));
    const res = response();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await journalController.listDepartments({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Error loading departments',
    });
  });
});
