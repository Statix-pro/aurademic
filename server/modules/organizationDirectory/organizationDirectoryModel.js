import db from '../../config/connection.js';

const ORG_FIELDS = [
  'name', 'abbreviation', 'establishment_year', 'sector', 'category', 'tag',
  'website', 'linked_in', 'address', 'city', 'state', 'country', 'pin_code', 'status',
];

const normalizePayload = (input = {}) => {
  const aliases = {
    establishment_year: 'establishmentYear',
    linked_in: 'linkedIn',
    pin_code: 'pinCode',
  };
  return Object.fromEntries(
    ORG_FIELDS.map((field) => {
      const value = input[field] ?? input[aliases[field]];
      return [field, value === '' ? null : value ?? null];
    }),
  );
};

const serialize = (row) => ({
  ...row,
  date: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : null,
});

export default {
  async listApproved(userId) {
    const [rows] = await db.query(
      `SELECT *, DATE(created_at) AS date FROM organizations
       WHERE created_by = ?
       ORDER BY id DESC`,
      [userId || 0],
    );
    return rows.map((row) => ({ ...serialize(row), approvalStatus: row.is_active ? 'Approved' : 'Pending' }));
  },

  async submit(input, userId) {
    const payload = normalizePayload(input);
    if (!payload.name) throw new Error('Organization name is required');
    const columns = [...ORG_FIELDS, 'is_active', 'created_by'];
    const values = [...ORG_FIELDS.map((field) => payload[field]), 0, userId || null];
    const [result] = await db.execute(
      `INSERT INTO organizations (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      values,
    );
    return { id: result.insertId, status: 'Pending', ...payload };
  },

  async update(id, input, userId) {
    const payload = normalizePayload(input);
    if (!payload.name) throw new Error('Organization name is required');
    const assignments = ORG_FIELDS.map((field) => `${field} = ?`).join(', ');
    const [result] = await db.execute(
      `UPDATE organizations SET ${assignments}, updated_by = ? WHERE id = ?`,
      [...ORG_FIELDS.map((field) => payload[field]), userId || null, id],
    );
    if (!result.affectedRows) throw new Error('Approved organization not found');
    const [rows] = await db.execute(
      'SELECT *, DATE(created_at) AS date FROM organizations WHERE id = ?', [id],
    );
    return serialize(rows[0]);
  },

  async listPending() {
    const [rows] = await db.query(
      `SELECT o.*, u.name AS submitted_by_name, u.email AS submitted_by_email
       FROM organizations o LEFT JOIN users u ON u.id = o.created_by
       ORDER BY o.created_at ASC`,
    );
    return rows.map((row) => ({ ...serialize(row), approvalStatus: row.is_active ? 'Approved' : (row.updated_by ? 'Rejected' : 'Pending'),
      submitted_by: row.created_by, submitted_by_name: row.submitted_by_name,
      submitted_by_email: row.submitted_by_email }));
  },

  async review(id, decision, reviewerId, comment) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        'SELECT * FROM organizations WHERE id = ? AND is_active = 0 FOR UPDATE', [id],
      );
      const submission = rows[0];
      if (!submission) throw new Error('Pending organization not found');
      if (decision === 'approve') {
        await connection.execute(
          'UPDATE organizations SET is_active = 1, status = \'Active\', updated_by = ? WHERE id = ?',
          [reviewerId, id],
        );
      } else {
        // Preserve rejected rows for the admin count/history. The existing table
        // has no approval-state column, so updated_by marks the reviewer.
        await connection.execute(
          "UPDATE organizations SET is_active = 0, status = 'Inactive', updated_by = ? WHERE id = ?",
          [reviewerId, id],
        );
      }
      await connection.commit();
      return { id: Number(id), status: decision === 'approve' ? 'Approved' : 'Rejected' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  },
};
