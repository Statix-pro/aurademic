import eventDb from '../../../config/eventConnection.js';

async function query(sql, params = []) {
  const [rows] = await eventDb.query(sql, params);
  return rows;
}

// 🔹 Get all finance records (summary only)
export const getFinanceRecords = async (req, res) => {
  try {
    const records = await query(
      'SELECT * FROM finance ORDER BY created_at DESC'
    );
    res.status(200).json(records);
  } catch (err) {
    console.error('❌ Error fetching finance records:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Get full finance record with details (Updated for frontend compatibility)
export const getFinanceById = async (req, res) => {
  const { id } = req.params;
  try {
    const [finance] = await query('SELECT * FROM finance WHERE id=?', [id]);

    if (!finance) {
      return res.status(404).json({ message: 'Finance record not found' });
    }

    // Fetch income data with agency information to match frontend incomeRows
    const incomeData = await query(
      'SELECT id, source as incomeHead, agency_name as agency, amount as income FROM finance_income WHERE finance_id=?',
      [id]
    );

    // Fetch expenditure data to match frontend expenditureRows structure
    const expenditureData = await query(
      `SELECT e.id, e.category as budgetHead, e.amount_proposed as amountProposed,
             e.amount as actualExpenditure, e.upload_id, u.filename, u.original_name
             FROM finance_expenditure e
             LEFT JOIN events_uploads u ON e.upload_id = u.id
             WHERE e.finance_id=?`,
      [id]
    );

    // Fetch sponsors data
    const sponsorsData = await query(
      'SELECT id, agency_name, amount FROM finance_sponsors WHERE finance_id=?',
      [id]
    );

    // Fetch supporting documents
    const docsData = await query(
      'SELECT id, filename, original_name, mime, size, uploaded_at FROM finance_docs WHERE finance_id=?',
      [id]
    );

    // Fetch budget data if connected to pre-event
    const budgetData = await query(
      'SELECT id, head, amount FROM budgets WHERE pre_event_id=?',
      [finance.event_id]
    );

    // Format response to match frontend expectations
    const response = {
      ...finance,
      incomeRows: incomeData.map((item) => ({
        id: item.id,
        incomeHead: item.incomeHead || '',
        agency: item.agency || '',
        income: parseFloat(item.income) || 0,
      })),
      expenditureRows: expenditureData.map((item) => ({
        id: item.id,
        budgetHead: item.budgetHead || '',
        amountProposed: parseFloat(item.amountProposed) || 0,
        actualExpenditure: parseFloat(item.actualExpenditure) || 0,
        file: item.filename
          ? {
              name: item.original_name,
              filename: item.filename,
              upload_id: item.upload_id,
            }
          : null,
      })),
      agencies: sponsorsData.map((item) => ({
        id: item.id,
        name: item.agency_name,
        amount: parseFloat(item.amount) || null,
      })),
      financeDocs: docsData,
      budgetRows: budgetData.map((item) => ({
        id: item.id,
        head: item.head,
        amount: parseFloat(item.amount) || 0,
      })),
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('❌ Error fetching finance by id:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Create new finance record (Updated for frontend compatibility)
export const createFinance = async (req, res) => {
  const {
    event_id,
    incomeRows = [],
    expenditureRows = [],
    agencies = [],
    financeDocs = [],
    budgetRows = [],
  } = req.body;

  if (!event_id) {
    return res.status(400).json({ error: 'event_id is required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Insert main finance record
    const [result] = await conn.query(
      'INSERT INTO finance (event_id) VALUES (?)',
      [event_id]
    );
    const financeId = result.insertId;

    // Helper function for bulk inserts
    const insertMany = async (table, cols, values) => {
      if (!values || values.length === 0) {
        return;
      }

      await conn.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ?`, [
        values,
      ]);
    };

    // Insert income data (map frontend structure to backend)
    const incomeValues = incomeRows
      .filter((row) => row.incomeHead && row.incomeHead.trim())
      .map((row) => [
        financeId,
        row.incomeHead.trim(),
        row.agency?.trim() || null,
        parseFloat(row.income) || 0,
      ]);
    await insertMany(
      'finance_income',
      ['finance_id', 'source', 'agency_name', 'amount'],
      incomeValues
    );

    // Insert expenditure data (map frontend structure to backend)
    const expenditureValues = expenditureRows
      .filter((row) => row.budgetHead && row.budgetHead.trim())
      .map((row) => [
        financeId,
        row.budgetHead.trim(),
        parseFloat(row.amountProposed) || 0,
        parseFloat(row.actualExpenditure) || 0,
        row.upload_id || null,
      ]);
    await insertMany(
      'finance_expenditure',
      ['finance_id', 'category', 'amount_proposed', 'amount', 'upload_id'],
      expenditureValues
    );

    // Insert sponsor agencies
    const agencyValues = agencies
      .filter((agency) => agency.name && agency.name.trim())
      .map((agency) => [
        financeId,
        agency.name.trim(),
        parseFloat(agency.amount) || null,
      ]);
    await insertMany(
      'finance_sponsors',
      ['finance_id', 'agency_name', 'amount'],
      agencyValues
    );

    // Insert supporting documents
    const docValues = financeDocs
      .filter((doc) => doc.filename && doc.filename.trim())
      .map((doc) => [
        financeId,
        doc.filename.trim(),
        doc.original_name?.trim() || doc.filename.trim(),
        doc.mime || null,
        parseInt(doc.size) || null,
      ]);
    await insertMany(
      'finance_docs',
      ['finance_id', 'filename', 'original_name', 'mime', 'size'],
      docValues
    );

    // Insert budget data (if provided)
    const budgetValues = budgetRows
      .filter((budget) => budget.head && budget.head.trim())
      .map((budget) => [
        event_id, // Note: budgets table uses pre_event_id which maps to event_id
        budget.head.trim(),
        parseFloat(budget.amount) || 0,
      ]);
    await insertMany(
      'budgets',
      ['pre_event_id', 'head', 'amount'],
      budgetValues
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      id: financeId,
      event_id,
      message: 'Finance record created successfully',
    });
  } catch (err) {
    await conn.rollback();
    console.error('❌ Error creating finance record:', err.message);
    console.error('❌ Full error details:', err);
    res.status(500).json({
      error: err.message,
      details:
        'Failed to create finance record. Please check your data and try again.',
    });
  } finally {
    conn.release();
  }
};

// 🔹 Update finance record (Updated for frontend compatibility)
export const updateFinance = async (req, res) => {
  const { id } = req.params;
  const {
    incomeRows = [],
    expenditureRows = [],
    agencies = [],
    financeDocs = [],
    budgetRows = [],
  } = req.body;

  const conn = await eventDb.getConnection();
  try {
    await conn.beginTransaction();

    // Check if finance record exists
    const [result] = await conn.query(
      'SELECT event_id FROM finance WHERE id=?',
      [id]
    );

    if (!result.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Finance record not found' });
    }

    const eventId = result[0].event_id;

    // Delete existing related data
    const financeRelated = [
      'finance_income',
      'finance_expenditure',
      'finance_sponsors',
      'finance_docs',
    ];

    for (const tbl of financeRelated) {
      await conn.query(`DELETE FROM ${tbl} WHERE finance_id=?`, [id]);
    }

    // Delete budgets using pre_event_id (which is the event_id)
    await conn.query(`DELETE FROM budgets WHERE pre_event_id=?`, [eventId]);

    // Helper function for bulk inserts
    const insertMany = async (table, cols, values) => {
      if (!values || values.length === 0) {
        return;
      }

      await conn.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ?`, [
        values,
      ]);
    };

    // Reinsert income data
    const incomeValues = incomeRows
      .filter((row) => row.incomeHead && row.incomeHead.trim())
      .map((row) => [
        id,
        row.incomeHead.trim(),
        row.agency?.trim() || null,
        parseFloat(row.income) || 0,
      ]);
    await insertMany(
      'finance_income',
      ['finance_id', 'source', 'agency_name', 'amount'],
      incomeValues
    );

    // Reinsert expenditure data
    const expenditureValues = expenditureRows
      .filter((row) => row.budgetHead && row.budgetHead.trim())
      .map((row) => [
        id,
        row.budgetHead.trim(),
        parseFloat(row.amountProposed) || 0,
        parseFloat(row.actualExpenditure) || 0,
        row.upload_id || null,
      ]);
    await insertMany(
      'finance_expenditure',
      ['finance_id', 'category', 'amount_proposed', 'amount', 'upload_id'],
      expenditureValues
    );

    // Reinsert sponsor agencies
    const agencyValues = agencies
      .filter((agency) => agency.name && agency.name.trim())
      .map((agency) => [
        id,
        agency.name.trim(),
        parseFloat(agency.amount) || null,
      ]);
    await insertMany(
      'finance_sponsors',
      ['finance_id', 'agency_name', 'amount'],
      agencyValues
    );

    // Reinsert supporting documents
    const docValues = financeDocs
      .filter((doc) => doc.filename && doc.filename.trim())
      .map((doc) => [
        id,
        doc.filename.trim(),
        doc.original_name?.trim() || doc.filename.trim(),
        doc.mime || null,
        parseInt(doc.size) || null,
      ]);
    await insertMany(
      'finance_docs',
      ['finance_id', 'filename', 'original_name', 'mime', 'size'],
      docValues
    );

    // Reinsert budget data
    const budgetValues = budgetRows
      .filter((budget) => budget.head && budget.head.trim())
      .map((budget) => [
        eventId,
        budget.head.trim(),
        parseFloat(budget.amount) || 0,
      ]);
    await insertMany(
      'budgets',
      ['pre_event_id', 'head', 'amount'],
      budgetValues
    );

    await conn.commit();

    res.status(200).json({
      success: true,
      message: 'Finance record updated successfully',
      id: parseInt(id),
    });
  } catch (err) {
    await conn.rollback();
    console.error('❌ Error updating finance record:', err.message);
    console.error('❌ Full error details:', err);
    res.status(500).json({
      error: err.message,
      details:
        'Failed to update finance record. Please check your data and try again.',
    });
  } finally {
    conn.release();
  }
};

// 🔹 Delete finance record (unchanged)
export const deleteFinance = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query('DELETE FROM finance WHERE id=?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Finance record not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Finance record deleted successfully',
    });
  } catch (err) {
    console.error('❌ Error deleting finance record:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Additional helper endpoint for file upload handling
export const handleFinanceFileUpload = async (req, res) => {
  try {
    const { event_id } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Insert file record into uploads table
    const [result] = await eventDb.query(
      'INSERT INTO events_uploads (event_id, filename, original_name, mime, size) VALUES (?, ?, ?, ?, ?)',
      [event_id, file.filename, file.originalname, file.mimetype, file.size]
    );

    const uploadId = result.insertId;

    res.status(200).json({
      success: true,
      upload_id: uploadId,
      filename: file.filename,
      original_name: file.originalname,
      message: 'File uploaded successfully',
    });
  } catch (err) {
    console.error('❌ Error handling file upload:', err.message);
    res.status(500).json({ error: err.message });
  }
};
