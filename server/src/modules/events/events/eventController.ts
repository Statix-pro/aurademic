import { Request, Response } from 'express';
import eventDb from '../../../config/eventConnection.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Helper query function
async function query<T>(sql: string, params: any[] = []): Promise<T> {
  const [rows] = await eventDb.query(sql, params);
  return rows as unknown as T;
}

// 🔹 Get all events (summary)
export const getEvents = async (req: Request, res: Response) => {
  try {
    const events = await query<RowDataPacket[]>(
      `SELECT id, title, status, created_at AS createdAt, updated_at AS updatedAt
       FROM events
       ORDER BY created_at DESC`
    );
    res.status(200).json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Get single event (full info)
export const getEventById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const events = await query<RowDataPacket[]>('SELECT * FROM events WHERE id=?', [id]);
    const event = events[0];
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(200).json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Get event summary for EventPage
export const getEventSummary = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const events = await query<RowDataPacket[]>(
      `SELECT id, title, status, created_at AS createdAt, updated_at AS updatedAt
       FROM events
       WHERE id=?`,
      [id]
    );
    const event = events[0];
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.status(200).json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Create new event
export const createEvent = async (req: Request, res: Response) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    const result = await query<ResultSetHeader>('INSERT INTO events (title) VALUES (?)', [
      title,
    ]);
    const events = await query<RowDataPacket[]>('SELECT * FROM events WHERE id=?', [
      result.insertId,
    ]);
    const newEvent = events[0];
    res.status(201).json(newEvent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Update event title
export const updateEvent = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title } = req.body;
  try {
    await query(
      'UPDATE events SET title=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [title, id]
    );
    const events = await query<RowDataPacket[]>('SELECT * FROM events WHERE id=?', [id]);
    const updated = events[0];
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// 🔹 Delete event
export const deleteEvent = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await query<ResultSetHeader>('DELETE FROM events WHERE id=?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
