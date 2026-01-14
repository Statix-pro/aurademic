// modules/finance/financeModel.js

import db from '../../config/connection.js';

/* =====================================================
   Helper: Safe JSON Parse (same philosophy as journals)
====================================================== */
const safeParseJSON = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const financeModel = {
  /* =====================================================
     CREATE FINANCE REQUEST
  ====================================================== */
  async createFinanceRequest(financeData, userId) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const financeEntry = {
        applicant_name: financeData.applicant_name,
        designation: financeData.designation || null,
        department: financeData.department || null,
        email: financeData.email || null,
        mobile: financeData.mobile || null,

        request_date: financeData.request_date,
        description: financeData.description || null,

        beneficiary_type: financeData.beneficiary_type,
        beneficiary_value: financeData.beneficiary_value || null,

        primary_head: financeData.primary_head,
        event_sub_head: financeData.event_sub_head || null,

        is_budget_proposed: financeData.is_budget_proposed || 'No',
        proposed_amount: financeData.proposed_amount || null,
        balance_amount: financeData.balance_amount || null,

        income_type: financeData.income_type || null,
        income_status: financeData.income_status || null,
        income_amount_type: financeData.income_amount_type || null,
        credit_status: financeData.credit_status || null,
        debit_status: financeData.debit_status || null,
        partial_amount: financeData.partial_amount || null,

        // ✅ FIXED: Proper JSON storage
        enclosures: financeData.enclosures
          ? JSON.stringify(financeData.enclosures)
          : null,

        total_budget: financeData.total_budget || 0,

        created_by: userId,
      };

      const [result] = await connection.query(
        'INSERT INTO finance_requests SET ?',
        [financeEntry]
      );

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error creating finance request: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  /* =====================================================
     UPDATE FINANCE REQUEST (APPLICANT)
  ====================================================== */
  async updateFinanceRequest(id, financeData) {
    try {
      const updateData = Object.fromEntries(
        Object.entries(financeData).filter(
          ([_, value]) => value !== undefined && value !== null
        )
      );

      // ✅ FIXED: JSON handling
      if (updateData.enclosures) {
        updateData.enclosures = JSON.stringify(updateData.enclosures);
      }

      const [result] = await db.query(
        'UPDATE finance_requests SET ? WHERE id = ? AND overall_status = "pending"',
        [updateData, id]
      );

      return result;
    } catch (error) {
      throw new Error(`Error updating finance request: ${error.message}`);
    }
  },

  /* =====================================================
     GET FINANCE REQUEST (FULL VIEW)
  ====================================================== */
  async getFinanceRequestById(id) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM finance_requests WHERE id = ?',
        [id]
      );

      if (!rows.length) return null;

      const finance = rows[0];

      // ✅ SAFE JSON parsing
      finance.enclosures = safeParseJSON(finance.enclosures, []);

      return finance;
    } catch (error) {
      throw new Error(`Error fetching finance request: ${error.message}`);
    }
  },

  /* =====================================================
     LIST FINANCE REQUESTS
  ====================================================== */
  async listFinanceRequests({ userId, mine, status }) {
    try {
      let query = 'SELECT * FROM finance_requests WHERE 1=1';
      const params = [];

      if (mine) {
        query += ' AND created_by = ?';
        params.push(userId);
      }

      if (status) {
        query += ' AND overall_status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC';

      const [rows] = await db.query(query, params);
      return rows;
    } catch (error) {
      throw new Error(`Error listing finance requests: ${error.message}`);
    }
  },

  /* =====================================================
     ADD BUDGET BREAKUP
  ====================================================== */
  async addBudgetBreakup(financeId, budgetRows) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      let total = 0;

      for (const row of budgetRows) {
        const amount = Number(row.amount) || 0;
        total += amount;

        await connection.query(
          `INSERT INTO finance_budget_breakup
           (finance_id, budget_head, sub_head, amount)
           VALUES (?, ?, ?, ?)`,
          [financeId, row.budget_head, row.sub_head, amount]
        );
      }

      await connection.query(
        'UPDATE finance_requests SET total_budget = ? WHERE id = ?',
        [total, financeId]
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error adding budget breakup: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  /* =====================================================
     GET BUDGET BREAKUP
  ====================================================== */
  async getBudgetBreakup(financeId) {
    try {
      const [rows] = await db.query(
        'SELECT * FROM finance_budget_breakup WHERE finance_id = ?',
        [financeId]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error fetching budget breakup: ${error.message}`);
    }
  },

  /* =====================================================
     STATUS UPDATES (APPROVAL WORKFLOW)
  ====================================================== */
  async addStatusUpdate(financeId, userId, role, status, comment) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `INSERT INTO finance_status_updates
         (finance_id, user_id, role, status, comment)
         VALUES (?, ?, ?, ?, ?)`,
        [financeId, userId, role, status, comment || null]
      );

      // Snapshot update
      const snapshotUpdate = {};
      snapshotUpdate[`${role}_status`] = status;
      snapshotUpdate[`${role}_comment`] = comment || null;

      await connection.query(
        'UPDATE finance_requests SET ? WHERE id = ?',
        [snapshotUpdate, financeId]
      );

      // Final approval
      if (role === 'chairman') {
        await connection.query(
          'UPDATE finance_requests SET overall_status = ? WHERE id = ?',
          [status, financeId]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error updating status: ${error.message}`);
    } finally {
      connection.release();
    }
  },

  /* =====================================================
     GET STATUS HISTORY
  ====================================================== */
  async getStatusUpdates(financeId) {
    try {
      const [rows] = await db.query(
        `SELECT fsu.*, u.name AS user_name
         FROM finance_status_updates fsu
         JOIN users u ON fsu.user_id = u.id
         WHERE fsu.finance_id = ?
         ORDER BY fsu.created_at ASC`,
        [financeId]
      );
      return rows;
    } catch (error) {
      throw new Error(`Error fetching status updates: ${error.message}`);
    }
  },

  /* =====================================================
     CHECK FINANCE EXISTS
  ====================================================== */
  async doesFinanceExist(id) {
    const [rows] = await db.query(
      'SELECT 1 FROM finance_requests WHERE id = ?',
      [id]
    );
    return rows.length > 0;
  },
};

export default financeModel;
