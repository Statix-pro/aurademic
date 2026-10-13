import { beforeEach, describe, expect, it, vi } from 'vitest';

import participantRegistrationController from '../modules/participantRegistration/participantRegistrationController.js';
import participantRegistrationModel, {
  NotImplementedError,
} from '../modules/participantRegistration/participantRegistrationModel.js';

vi.mock('../modules/participantRegistration/participantRegistrationModel.js', async () => {
  const actual = await vi.importActual(
    '../modules/participantRegistration/participantRegistrationModel.js',
  );

  return {
    ...actual,
    default: {
      findProfile: vi.fn(),
      findOwnedRegistration: vi.fn(),
      getRegistrationContext: vi.fn(),
      findRoomType: vi.fn(),
      saveAccommodation: vi.fn(),
    },
  };
});

describe('accommodation pricing', () => {
  let req;
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    participantRegistrationModel.findOwnedRegistration.mockResolvedValue({ id: 5, event_id: 9 });
    participantRegistrationModel.saveAccommodation.mockResolvedValue(undefined);
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    req = {
      params: { id: '5' },
      participant: { id: 1 },
      body: {
        required: true,
        checkInDate: '2026-09-01',
        checkOutDate: '2026-09-03',
        rooms: [{ roomTypeId: 2, occupants: 2, roomsCount: 1 }],
      },
    };
  });

  const responded = () => res.json.mock.calls.at(-1)[0];

  // price_per_night sits beside max_occupants (the capacity of ONE room at that
  // rate) and total_rooms, so it is a per-room rate. Multiplying by occupants as
  // well billed a 2-person room for 2 nights at 4x the nightly rate.
  it('prices a room per night and per room, never per occupant', async () => {
    participantRegistrationModel.findRoomType.mockResolvedValue({
      id: 2,
      room_type: 'Twin Sharing',
      price_per_night: 1000,
      max_occupants: 2,
    });

    await participantRegistrationController.saveAccommodation(req, res);

    // 1000 per night x 2 nights x 1 room. Not x2 again for the two occupants.
    expect(responded().data.totalAmount).toBe(2000);
    expect(responded().data.rooms[0].amount).toBe(2000);
  });

  it('multiplies by the number of rooms', async () => {
    participantRegistrationModel.findRoomType.mockResolvedValue({
      id: 2,
      room_type: 'Twin Sharing',
      price_per_night: 1000,
      max_occupants: 2,
    });
    req.body.rooms = [{ roomTypeId: 2, occupants: 1, roomsCount: 3 }];

    await participantRegistrationController.saveAccommodation(req, res);

    expect(responded().data.totalAmount).toBe(6000);
  });

  it('still refuses more occupants than the room holds', async () => {
    participantRegistrationModel.findRoomType.mockResolvedValue({
      id: 2,
      room_type: 'Single',
      price_per_night: 1000,
      max_occupants: 1,
    });
    req.body.rooms = [{ roomTypeId: 2, occupants: 4, roomsCount: 1 }];

    await participantRegistrationController.saveAccommodation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(responded().message).toMatch(/at most 1 occupants/);
  });
});

describe('unbuilt endpoints', () => {
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    participantRegistrationModel.findProfile.mockResolvedValue({
      personal_completed_at: '2026-08-01',
      profession_completed_at: '2026-08-01',
    });
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  // A mounted-but-unwritten route is 501, not 500: a client can tell "not built
  // yet" from "the server broke", and a real fault stays visible in the logs.
  it('answers 501 rather than 500', async () => {
    participantRegistrationModel.findOwnedRegistration.mockResolvedValue({ id: 5, event_id: 9 });
    participantRegistrationModel.getRegistrationContext.mockRejectedValue(
      new NotImplementedError('getRegistrationContext'),
    );

    await participantRegistrationController.createRegistration(
      { participant: { id: 1 }, body: { eventId: 9 } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(501);
  });

  it('still answers 500 for a genuine failure', async () => {
    participantRegistrationModel.getRegistrationContext.mockRejectedValue(
      new Error('connection lost'),
    );

    await participantRegistrationController.createRegistration(
      { participant: { id: 1 }, body: { eventId: 9 } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
