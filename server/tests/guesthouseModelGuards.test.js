import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/connection.js', () => ({
  default: { getConnection: vi.fn() },
}));

import db from '../config/connection.js';
import guesthouseModel from '../modules/guesthouse/guesthouseModel.js';

const makeTransaction = (queryHandler) => ({
  beginTransaction: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue(undefined),
  rollback: vi.fn().mockResolvedValue(undefined),
  release: vi.fn(),
  query: vi.fn(queryHandler),
});

describe('Guest House database guards', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses a current locking read and full timestamps for room conflicts', async () => {
    const booking = {
      id: 25,
      check_in_date: '2026-10-11',
      check_in_time: '15:00',
      check_out_date: '2026-10-11',
      check_out_time: '17:00',
      workflow_state: JSON.stringify({ currentStage: 'guesthouse_admin', status: 'in_progress' }),
      workflow_status: 'in_progress',
      workflow_stage: 'guesthouse_admin',
      overall_status: 'pending',
    };
    const calls = [];
    const tx = makeTransaction(async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT booking_id FROM guesthouse_room_allotments')) return [[{ booking_id: 25 }]];
      if (sql.includes('FROM guesthouse_bookings WHERE id = ? FOR UPDATE')) return [[booking]];
      if (sql.includes('FROM guesthouse_rooms WHERE id = ?')) return [[{ id: 9 }]];
      if (sql.includes('SELECT gb.id FROM guesthouse_room_allotment_rows')) return [[]];
      if (sql.includes('WHERE gra.booking_id = ?') && sql.includes('LIMIT 1 FOR UPDATE')) return [[]];
      if (sql.includes('INSERT INTO guesthouse_room_allotment_rows')) return [{ insertId: 101 }];
      throw new Error(`Unexpected query: ${sql}`);
    });
    db.getConnection.mockResolvedValue(tx);

    await guesthouseModel.addRoomAllotmentRow(5, {
      roomId: 9,
      roomType: 'Single',
      block: 'A',
      roomNumber: '101',
      occupants: 0,
    });

    const bookingLock = calls.find(({ sql }) => sql.includes('FROM guesthouse_bookings WHERE id = ? FOR UPDATE'));
    const conflictCheck = calls.find(({ sql }) => sql.includes('SELECT gb.id FROM guesthouse_room_allotment_rows'));
    expect(bookingLock).toBeDefined();
    expect(conflictCheck.sql).toContain('CAST(CONCAT(gb.check_in_date');
    expect(conflictCheck.sql).toContain('CAST(CONCAT(gb.check_out_date');
    expect(conflictCheck.sql).toMatch(/LIMIT 1 FOR UPDATE$/);
    expect(conflictCheck.params.slice(-4)).toEqual(['2026-10-11', '17:00', '2026-10-11', '15:00']);
    expect(tx.commit).toHaveBeenCalledOnce();
  });

  it('rejects an edit when the workflow stage changed before its transaction acquired the row lock', async () => {
    const tx = makeTransaction(async (sql) => {
      if (sql.includes('FROM guesthouse_bookings WHERE id = ? FOR UPDATE')) {
        return [[{
          id: 25,
          workflow_state: JSON.stringify({ currentStage: 'guesthouse_incharge', status: 'in_progress' }),
          workflow_status: 'in_progress',
          workflow_stage: 'guesthouse_incharge',
          overall_status: 'pending',
        }]];
      }
      throw new Error(`Unexpected query after workflow guard: ${sql}`);
    });
    db.getConnection.mockResolvedValue(tx);

    await expect(guesthouseModel.updateGuesthouseBooking(25, {}, {
      expectedWorkflowStage: 'hod',
      allowedWorkflowStatuses: ['in_progress', 'pending'],
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(tx.rollback).toHaveBeenCalledOnce();
    expect(tx.commit).not.toHaveBeenCalled();
  });

  it('fails closed when a booking or actor has no owner ID during deletion', async () => {
    const tx = makeTransaction(async (sql) => {
      if (sql.includes('FROM guesthouse_bookings WHERE id = ? FOR UPDATE')) {
        return [[{
          id: 25,
          created_by: null,
          workflow_state: JSON.stringify({ currentStage: 'hod', status: 'in_progress' }),
          workflow_status: 'in_progress',
          workflow_stage: 'hod',
          overall_status: 'pending',
        }]];
      }
      throw new Error(`Unexpected query after owner guard: ${sql}`);
    });
    db.getConnection.mockResolvedValue(tx);

    await expect(guesthouseModel.deleteGuesthouseBooking(25)).rejects.toMatchObject({ statusCode: 403 });

    expect(tx.query).toHaveBeenCalledTimes(1);
    expect(tx.rollback).toHaveBeenCalledOnce();
    expect(tx.commit).not.toHaveBeenCalled();
  });
});
