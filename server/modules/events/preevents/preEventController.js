import eventDb from '../../../config/eventConnection.js';

// Utility: run queries
async function query(sql, params = []) {
  const [rows] = await eventDb.query(sql, params);
  return rows;
}

// 🔹 Get all pre-events
export const getPreEvents = async (req, res) => {
  try {
    const events = await query(
      'SELECT * FROM pre_events ORDER BY start_date DESC'
    );
    res.status(200).json(events);
  } catch (err) {
    console.error('❌ Error in getPreEvents:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Get a single pre-event with all details (Updated for frontend compatibility)
export const getPreEventById = async (req, res) => {
  const { id } = req.params;

  try {
    const [event] = await query('SELECT * FROM pre_events WHERE id = ?', [id]);

    if (!event) {
      return res.status(404).json({ message: 'Pre-event not found' });
    }

    // Fetch related arrays

    const event_types = await query(
      'SELECT type_name FROM event_types WHERE pre_event_id=?',
      [id]
    );
    const departments = await query(
      'SELECT name FROM departments WHERE pre_event_id=?',
      [id]
    );
    const target_audience = await query(
      'SELECT audience FROM target_audience WHERE pre_event_id=?',
      [id]
    );
    const themes = await query(
      'SELECT theme FROM themes WHERE pre_event_id=?',
      [id]
    );
    const sdgs = await query('SELECT sdg_name FROM sdgs WHERE pre_event_id=?', [
      id,
    ]);
    const collaborations = await query(
      'SELECT collaborator FROM collaborations WHERE pre_event_id=?',
      [id]
    );

    // Updated coordinator query to match frontend expectations
    const coordinators = await query(
      'SELECT id, name, department, mobile, email FROM coordinators WHERE pre_event_id=?',
      [id]
    );

    // Updated budget query to match frontend budgetRows structure
    const budgetRows = await query(
      'SELECT id, head, amount FROM budgets WHERE pre_event_id=?',
      [id]
    );

    // Format response to match frontend expectations
    const result = {
      ...event,
      eventType: event_types.map((e) => e.type_name), // Changed from event_type to eventType
      department: departments.map((d) => d.name),
      targetAudience: target_audience.map((a) => a.audience), // Changed from target_audience to targetAudience
      theme: themes.map((t) => t.theme),
      sdg: sdgs.map((s) => s.sdg_name),
      collaborations: collaborations.map((c) => c.collaborator),
      coordinators: coordinators.map((c) => ({
        id: c.id,
        name: c.name,
        department: c.department,
        mobile: c.mobile,
        email: c.email,
      })),
      budgetRows: budgetRows.map((b) => ({
        id: b.id,
        head: b.head,
        amount: parseFloat(b.amount) || 0,
      })),
    };

    res.status(200).json(result);
  } catch (err) {
    console.error('❌ Error in getPreEventById:', err.message);
    console.error('❌ Full error:', err);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Create a new pre-event (Updated for frontend compatibility)
export const createPreEvent = async (req, res) => {
  const {
    title,
    eventType = [], // Changed from event_type
    department = [],
    targetAudience = [], // Changed from target_audience
    startDate, // Changed from start_date
    endDate, // Changed from end_date
    theme = [],
    sdg = [],
    inauguralDate, // Changed from inaugural_date
    inauguralTime, // Changed from inaugural_time
    inauguralVenue, // Changed from inaugural_venue
    valedictoryDate, // Changed from valedictory_date
    valedictoryTime, // Changed from valedictory_time
    valedictoryVenue, // Changed from valedictory_venue
    mode,
    meetingLink, // Changed from meeting_link
    collaborations = [],
    coordinators = [],
    budgetRows = [], // Changed from budget to budgetRows
    level, // Added level field
    description, // Added description field
    expectedParticipants, // Added expected participants
  } = req.body;

  // Handle legacy field names for backward compatibility
  const event_type =
    eventType.length > 0 ? eventType : req.body.event_type || [];
  const target_audience =
    targetAudience.length > 0 ? targetAudience : req.body.target_audience || [];
  const start_date = startDate || req.body.start_date;
  const end_date = endDate || req.body.end_date;
  const inaugural_date = inauguralDate || req.body.inaugural_date;
  const inaugural_time = inauguralTime || req.body.inaugural_time;
  const inaugural_venue = inauguralVenue || req.body.inaugural_venue;
  const valedictory_date = valedictoryDate || req.body.valedictory_date;
  const valedictory_time = valedictoryTime || req.body.valedictory_time;
  const valedictory_venue = valedictoryVenue || req.body.valedictory_venue;
  const meeting_link = meetingLink || req.body.meeting_link;
  const budget = budgetRows.length > 0 ? budgetRows : req.body.budget || [];

  if (!title || !start_date || !end_date) {
    return res.status(400).json({
      error: 'Title, Start Date, and End Date are required',
      missingFields: {
        title: !title,
        startDate: !start_date,
        endDate: !end_date,
      },
    });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    // Insert main event with additional fields
    const [result] = await conn.query(
      `INSERT INTO pre_events
            (title, start_date, end_date, inaugural_date, inaugural_time, inaugural_venue,
             valedictory_date, valedictory_time, valedictory_venue, mode, meeting_link,
             level, description, expected_participants, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        title,
        start_date,
        end_date,
        inaugural_date,
        inaugural_time,
        inaugural_venue,
        valedictory_date,
        valedictory_time,
        valedictory_venue,
        mode,
        meeting_link,
        level,
        description,
        expectedParticipants,
      ]
    );

    const preEventId = result.insertId;

    // Helper bulk insert function
    const insertMany = async (table, column, values) => {
      if (!values || values.length === 0) {
        return;
      }

      const rows = values
        .filter((v) => v && v.trim())
        .map((v) => [preEventId, v.trim()]);

      if (rows.length > 0) {
        await conn.query(
          `INSERT INTO ${table} (pre_event_id, ${column}) VALUES ?`,
          [rows]
        );
      }
    };

    // Insert related data
    await insertMany('event_types', 'type_name', event_type);
    await insertMany('departments', 'name', department);
    await insertMany('target_audience', 'audience', target_audience);
    await insertMany('themes', 'theme', theme);
    await insertMany('sdgs', 'sdg_name', sdg);
    await insertMany('collaborations', 'collaborator', collaborations);

    // Insert coordinators with proper field mapping
    if (coordinators && coordinators.length > 0) {
      const validCoordinators = coordinators.filter(
        (c) => c.name && c.name.trim()
      );

      if (validCoordinators.length > 0) {
        const rows = validCoordinators.map((c) => [
          preEventId,
          c.name.trim(),
          c.department?.trim() || null,
          c.mobile?.trim() || null,
          c.email?.trim() || null,
        ]);

        await conn.query(
          `INSERT INTO coordinators (pre_event_id, name, department, mobile, email) VALUES ?`,
          [rows]
        );
      }
    }

    // Insert budget data with proper validation
    if (budget && budget.length > 0) {
      const validBudgets = budget.filter(
        (b) => b.head && b.head.trim() && b.amount
      );

      if (validBudgets.length > 0) {
        for (const budgetItem of validBudgets) {
          const amount = parseFloat(budgetItem.amount) || 0;
          if (amount > 0) {
            await conn.query(
              'INSERT INTO budgets (pre_event_id, head, amount) VALUES (?, ?, ?)',
              [preEventId, budgetItem.head.trim(), amount]
            );
          }
        }
      }
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      id: preEventId,
      title,
      message: 'Pre-event created successfully',
    });
  } catch (err) {
    await conn.rollback();
    console.error('❌ Transaction rolled back due to error:', err.message);
    console.error('❌ Full error details:', err);
    res.status(500).json({
      error: err.message,
      details:
        'Failed to create pre-event. Please check your data and try again.',
    });
  } finally {
    conn.release();
  }
};

// 🔹 Update pre-event (Updated for frontend compatibility)
export const updatePreEvent = async (req, res) => {
  const { id } = req.params;

  const {
    title,
    eventType = [],
    department = [],
    targetAudience = [],
    startDate,
    endDate,
    theme = [],
    sdg = [],
    inauguralDate,
    inauguralTime,
    inauguralVenue,
    valedictoryDate,
    valedictoryTime,
    valedictoryVenue,
    mode,
    meetingLink,
    collaborations = [],
    coordinators = [],
    budgetRows = [],
    level,
    description,
    expectedParticipants,
  } = req.body;

  // Handle legacy field names
  const event_type =
    eventType.length > 0 ? eventType : req.body.event_type || [];
  const target_audience =
    targetAudience.length > 0 ? targetAudience : req.body.target_audience || [];
  const start_date = startDate || req.body.start_date;
  const end_date = endDate || req.body.end_date;
  const inaugural_date = inauguralDate || req.body.inaugural_date;
  const inaugural_time = inauguralTime || req.body.inaugural_time;
  const inaugural_venue = inauguralVenue || req.body.inaugural_venue;
  const valedictory_date = valedictoryDate || req.body.valedictory_date;
  const valedictory_time = valedictoryTime || req.body.valedictory_time;
  const valedictory_venue = valedictoryVenue || req.body.valedictory_venue;
  const meeting_link = meetingLink || req.body.meeting_link;
  const budget = budgetRows.length > 0 ? budgetRows : req.body.budget || [];

  const conn = await eventDb.getConnection();

  try {
    await conn.beginTransaction();

    // Update main event record
    const [result] = await conn.query(
      `UPDATE pre_events SET
             title=?, start_date=?, end_date=?, inaugural_date=?, inaugural_time=?, inaugural_venue=?,
             valedictory_date=?, valedictory_time=?, valedictory_venue=?, mode=?, meeting_link=?,
             level=?, description=?, expected_participants=?, updated_at=NOW()
             WHERE id=?`,
      [
        title,
        start_date,
        end_date,
        inaugural_date,
        inaugural_time,
        inaugural_venue,
        valedictory_date,
        valedictory_time,
        valedictory_venue,
        mode,
        meeting_link,
        level,
        description,
        expectedParticipants,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Pre-event not found' });
    }

    // Clear existing related data
    const relatedTables = [
      'event_types',
      'departments',
      'target_audience',
      'themes',
      'sdgs',
      'collaborations',
      'coordinators',
      'budgets',
    ];

    for (const tbl of relatedTables) {
      await conn.query(`DELETE FROM ${tbl} WHERE pre_event_id=?`, [id]);
    }

    // Reinsert new data
    const insertMany = async (table, column, values) => {
      if (!values || values.length === 0) {
        return;
      }

      const rows = values
        .filter((v) => v && v.trim())
        .map((v) => [id, v.trim()]);

      if (rows.length > 0) {
        await conn.query(
          `INSERT INTO ${table} (pre_event_id, ${column}) VALUES ?`,
          [rows]
        );
      }
    };

    await insertMany('event_types', 'type_name', event_type);
    await insertMany('departments', 'name', department);
    await insertMany('target_audience', 'audience', target_audience);
    await insertMany('themes', 'theme', theme);
    await insertMany('sdgs', 'sdg_name', sdg);
    await insertMany('collaborations', 'collaborator', collaborations);

    // Reinsert coordinators
    if (coordinators && coordinators.length > 0) {
      const validCoordinators = coordinators.filter(
        (c) => c.name && c.name.trim()
      );

      if (validCoordinators.length > 0) {
        const rows = validCoordinators.map((c) => [
          id,
          c.name.trim(),
          c.department?.trim() || null,
          c.mobile?.trim() || null,
          c.email?.trim() || null,
        ]);

        await conn.query(
          `INSERT INTO coordinators (pre_event_id, name, department, mobile, email) VALUES ?`,
          [rows]
        );
      }
    }

    // Reinsert budget data
    if (budget && budget.length > 0) {
      const validBudgets = budget.filter(
        (b) => b.head && b.head.trim() && b.amount
      );

      if (validBudgets.length > 0) {
        for (const budgetItem of validBudgets) {
          const amount = parseFloat(budgetItem.amount) || 0;
          if (amount > 0) {
            await conn.query(
              'INSERT INTO budgets (pre_event_id, head, amount) VALUES (?, ?, ?)',
              [id, budgetItem.head.trim(), amount]
            );
          }
        }
      }
    }

    await conn.commit();

    res.status(200).json({
      success: true,
      message: 'Pre-event updated successfully',
      id: parseInt(id),
    });
  } catch (err) {
    await conn.rollback();
    console.error(
      '❌ Update transaction rolled back due to error:',
      err.message
    );
    console.error('❌ Full error details:', err);
    res.status(500).json({
      error: err.message,
      details:
        'Failed to update pre-event. Please check your data and try again.',
    });
  } finally {
    conn.release();
  }
};

// 🔹 Delete pre-event (cascade will remove related)
export const deletePreEvent = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await query('DELETE FROM pre_events WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Pre-event not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Pre-event deleted successfully',
    });
  } catch (err) {
    console.error('❌ Error in deletePreEvent:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Additional helper endpoints for frontend

// Get dropdown options
export const getDropdownOptions = async (req, res) => {
  try {
    const options = {
      eventTypes: [
        { value: 'seminar', label: 'Seminar' },
        { value: 'workshop', label: 'Workshop' },
        { value: 'guest-lecture', label: 'Guest Lecture' },
        { value: 'conference', label: 'Conference' },
        { value: 'symposium', label: 'Symposium' },
        { value: 'fdp', label: 'Faculty Development Program (FDP)' },
        { value: 'hackathon', label: 'Hackathon' },
        { value: 'techfest', label: 'Technical Festival' },
        { value: 'cultural', label: 'Cultural Event' },
        { value: 'sports', label: 'Sports Event' },
        { value: 'competition', label: 'Competition' },
        { value: 'project-expo', label: 'Project Expo' },
        { value: 'alumni-meet', label: 'Alumni Meet' },
        { value: 'induction', label: 'Student Induction Program' },
        { value: 'orientation', label: 'Orientation Program' },
        { value: 'training', label: 'Training Program' },
      ],
      levels: [
        { value: 'international', label: 'International' },
        { value: 'national', label: 'National' },
        { value: 'state', label: 'State' },
        { value: 'district', label: 'District' },
        { value: 'intra_college', label: 'Intra-College' },
      ],
      themes: [
        { value: 'industry', label: 'Industry' },
        { value: 'innovation', label: 'Innovation' },
        { value: 'designing', label: 'Designing' },
        { value: 'ai', label: 'Artificial Intelligence' },
        { value: 'ml', label: 'Machine Learning' },
        { value: 'iot', label: 'Internet of Things' },
        { value: 'cybersecurity', label: 'Cybersecurity' },
        { value: 'blockchain', label: 'Blockchain' },
      ],
      targetAudience: [
        { value: 'students', label: 'Students' },
        { value: 'faculty', label: 'Faculty Members' },
        { value: 'research-scholars', label: 'Research Scholars' },
        { value: 'industry-people', label: 'Industry People' },
        { value: 'alumni', label: 'Alumni' },
        { value: 'all', label: 'Open At All' },
        { value: 'others', label: 'Others' },
      ],
    };

    res.status(200).json(options);
  } catch (err) {
    console.error('❌ Error in getDropdownOptions:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Validate pre-event data
export const validatePreEventData = async (req, res) => {
  const { title, startDate, endDate, eventType } = req.body;

  const errors = [];

  if (!title || title.trim().length < 3) {
    errors.push('Title must be at least 3 characters long');
  }

  if (!startDate) {
    errors.push('Start date is required');
  }

  if (!endDate) {
    errors.push('End date is required');
  }

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    errors.push('Start date cannot be after end date');
  }

  if (!eventType || eventType.length === 0) {
    errors.push('At least one event type must be selected');
  }

  res.status(200).json({
    valid: errors.length === 0,
    errors,
  });
};
