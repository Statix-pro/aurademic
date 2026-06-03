import db from '../../config/connection.js';

const normalizeText = (value) => String(value ?? '').trim();
const toPositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const accountOptionsModel = {
  async listAccountOptions() {
    const [rows] = await db.query(
      `SELECT id, account_name AS name, sort_order
         FROM account_options
        WHERE is_active = 1
          AND is_deleted = 0
        ORDER BY sort_order ASC, account_name ASC`,
    );
    return rows;
  },

  async createAccountOption({ accountName, actorUserId = null }) {
    const normalizedAccountName = normalizeText(accountName);
    if (!normalizedAccountName) {
      const error = new Error('Account name is required');
      error.statusCode = 400;
      throw error;
    }

    const [result] = await db.query(
      `INSERT INTO account_options (account_name, sort_order, created_by, updated_by)
       VALUES (
         ?,
         (SELECT next_sort_order FROM (
           SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
             FROM account_options
         ) AS sort_source),
         ?,
         ?
       )
       ON DUPLICATE KEY UPDATE
         id = LAST_INSERT_ID(id),
         account_name = VALUES(account_name),
         is_active = 1,
         is_deleted = 0,
         updated_by = VALUES(updated_by)`,
      [
        normalizedAccountName,
        toPositiveInt(actorUserId),
        toPositiveInt(actorUserId),
      ],
    );

    return { id: result.insertId, name: normalizedAccountName };
  },

  async updateAccountOption(id, { accountName, actorUserId = null } = {}) {
    const accountId = toPositiveInt(id);
    const normalizedAccountName = normalizeText(accountName);

    if (!accountId) {
      const error = new Error('Invalid account option ID');
      error.statusCode = 400;
      throw error;
    }

    if (!normalizedAccountName) {
      const error = new Error('Account name is required');
      error.statusCode = 400;
      throw error;
    }

    const [existingRows] = await db.query(
      `SELECT id
         FROM account_options
        WHERE LOWER(TRIM(account_name)) = LOWER(TRIM(?))
          AND id <> ?
        LIMIT 1`,
      [normalizedAccountName, accountId],
    );

    if (existingRows.length > 0) {
      const error = new Error('Account option already exists');
      error.statusCode = 409;
      throw error;
    }

    const [result] = await db.query(
      `UPDATE account_options
          SET account_name = ?,
              is_active = 1,
              is_deleted = 0,
              updated_by = ?
        WHERE id = ?`,
      [normalizedAccountName, toPositiveInt(actorUserId), accountId],
    );

    if (result.affectedRows === 0) {
      return null;
    }

    return { id: accountId, name: normalizedAccountName };
  },

  async deleteAccountOption(id, { actorUserId = null } = {}) {
    const accountId = toPositiveInt(id);
    if (!accountId) {
      const error = new Error('Invalid account option ID');
      error.statusCode = 400;
      throw error;
    }

    const [result] = await db.query(
      `UPDATE account_options
          SET is_active = 0,
              is_deleted = 1,
              updated_by = ?
        WHERE id = ?`,
      [toPositiveInt(actorUserId), accountId],
    );

    return result.affectedRows > 0;
  },
};

export default accountOptionsModel;
