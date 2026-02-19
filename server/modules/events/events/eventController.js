import logger from '../../../config/logger.js';
import eventDb from '../../../config/connection.js';

// Helper query function
async function query(sql, params = []) {
  const [rows] = await eventDb.query(sql, params);
  return rows;
}

// 🔹 Get all events (summary)
export const getEvents = async (req, res) => {
  try {
    const events = await query(
      `SELECT id, title, status, created_at AS createdAt, updated_at AS updatedAt
       FROM events
       ORDER BY created_at DESC`
    );
    res.status(200).json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Get single event (full info)
export const getEventById = async (req, res) => {
  const { id } = req.params;
  try {
    const [event] = await query('SELECT * FROM events WHERE id=?', [id]);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Get event summary for EventPage
export const getEventSummary = async (req, res) => {
  const { id } = req.params;
  try {
    const [event] = await query(
      `SELECT id, title, status, created_at AS createdAt, updated_at AS updatedAt
       FROM events
       WHERE id=?`,
      [id]
    );
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Create new event
export const createEvent = async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = await query('INSERT INTO events (title) VALUES (?)', [
      title,
    ]);
    const [newEvent] = await query('SELECT * FROM events WHERE id=?', [
      result.insertId,
    ]);
    res.status(201).json(newEvent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Update event title
export const updateEvent = async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  try {
    await query(
      'UPDATE events SET title=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [title, id]
    );
    const [updated] = await query('SELECT * FROM events WHERE id=?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Delete event
export const deleteEvent = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query('DELETE FROM events WHERE id=?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
