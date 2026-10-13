import { beforeEach, describe, expect, it, vi } from 'vitest';

import eventsController from '../modules/events/eventsController.js';
import eventsModel from '../modules/events/eventsModel.js';

vi.mock('../modules/events/eventsModel.js', () => ({
  default: {
    listPublicEvents: vi.fn(),
    findPublicEventById: vi.fn(),
    listEventFees: vi.fn(),
    listAccommodationRoomTypes: vi.fn(),
    listSubEvents: vi.fn(),
  },
}));

const row = (id, parentId = null) => ({
  id,
  refNo: `EVT-${id}`,
  title: `Event ${id}`,
  parentId,
  registrationStatus: 'Ongoing',
  registeredCount: 0,
  maxParticipants: null,
  registrationClosesAt: null,
});

describe('public events nesting', () => {
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  const listed = () => res.json.mock.calls.at(-1)[0];

  it('nests a child under its parent', async () => {
    eventsModel.listPublicEvents.mockResolvedValue([row(1), row(2, 1)]);

    await eventsController.listPublicEvents({}, res);

    const { events } = listed().data;
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('1');
    expect(events[0].subEvents.map((e) => e.id)).toEqual(['2']);
  });

  // fk_events_parent permits parent_id = id, and nothing forbids a two-row cycle.
  // Nesting one would build a self-referencing object and res.json's
  // JSON.stringify would throw, turning one bad row into a 500 for the whole
  // public catalogue.
  it('does not 500 on an event that is its own parent', async () => {
    eventsModel.listPublicEvents.mockResolvedValue([row(1, 1)]);

    await eventsController.listPublicEvents({}, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(() => JSON.stringify(listed())).not.toThrow();
    expect(listed().data.events.map((e) => e.id)).toEqual(['1']);
  });

  it('does not 500 on a two-row parent cycle', async () => {
    eventsModel.listPublicEvents.mockResolvedValue([row(1, 2), row(2, 1)]);

    await eventsController.listPublicEvents({}, res);

    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(() => JSON.stringify(listed())).not.toThrow();
    expect(listed().data.events).toHaveLength(2);
  });

  it('keeps an orphan whose parent is not public as a root', async () => {
    eventsModel.listPublicEvents.mockResolvedValue([row(3, 99)]);

    await eventsController.listPublicEvents({}, res);

    expect(listed().data.events.map((e) => e.id)).toEqual(['3']);
  });
});
