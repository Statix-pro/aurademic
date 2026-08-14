import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_PARTICIPANT_SECRET = 'test-participant-secret';
process.env.GOOGLE_PARTICIPANT_CLIENT_ID = 'test-participant-client-id';

import { getParticipantGoogleClientId } from '../config/participantAuth.js';
import participantAuthController from '../modules/participantAuth/participantAuthController.js';
import participantAuthModel from '../modules/participantAuth/participantAuthModel.js';

const verifyIdToken = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    constructor(clientId) {
      this.clientId = clientId;
    }

    verifyIdToken(options) {
      return verifyIdToken(options);
    }
  },
}));

vi.mock('../modules/participantAuth/participantAuthModel.js', () => ({
  default: {
    findOrCreateParticipant: vi.fn(),
    findParticipantWithProfileById: vi.fn(),
    findActiveParticipantById: vi.fn(),
  },
}));

describe('getParticipantGoogleClientId', () => {
  const original = {
    participant: process.env.GOOGLE_PARTICIPANT_CLIENT_ID,
    staff: process.env.GOOGLE_CLIENT_ID,
  };

  afterEach(() => {
    process.env.GOOGLE_PARTICIPANT_CLIENT_ID = original.participant;

    if (original.staff === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = original.staff;
    }
  });

  // Guards the auth bypass: google-auth-library skips audience verification when
  // `audience` is undefined, which would accept an ID token from any Google app.
  it('throws rather than returning undefined when no client id is configured', () => {
    delete process.env.GOOGLE_PARTICIPANT_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    expect(() => getParticipantGoogleClientId()).toThrow(/required to verify participant sign-in/);
  });

  it('falls back to the staff client id', () => {
    delete process.env.GOOGLE_PARTICIPANT_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'staff-client-id';

    expect(getParticipantGoogleClientId()).toBe('staff-client-id');
  });
});

describe('participant login account guards', () => {
  let req;
  let res;

  const googlePayload = {
    email: 'public@gmail.com',
    name: 'Public User',
    sub: 'google-sub-1',
    email_verified: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    verifyIdToken.mockResolvedValue({ getPayload: () => googlePayload });
    req = { body: { credential: 'a-google-id-token' } };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  const login = () => participantAuthController.googleLogin(req, res);

  const respondedWith = () => res.json.mock.calls.at(-1)?.[0];

  it('verifies the Google token against the configured audience', async () => {
    participantAuthModel.findOrCreateParticipant.mockResolvedValue({
      id: 1,
      email: googlePayload.email,
      is_blocked: 0,
      is_active: 1,
      is_deleted: 0,
    });

    await login();

    expect(verifyIdToken).toHaveBeenCalledWith(
      expect.objectContaining({ audience: 'test-participant-client-id' }),
    );
  });

  it('issues a token for an ordinary account', async () => {
    participantAuthModel.findOrCreateParticipant.mockResolvedValue({
      id: 1,
      email: googlePayload.email,
      name: 'Public User',
      is_blocked: 0,
      is_active: 1,
      is_deleted: 0,
    });

    await login();

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(respondedWith()).toMatchObject({ success: true });
    expect(respondedWith().data.token).toEqual(expect.any(String));
  });

  // Was a 500: the lookup filtered is_deleted, so login fell through to an INSERT
  // that collided with the unconditional unique index on email.
  it('refuses a removed account with a reason instead of a server error', async () => {
    participantAuthModel.findOrCreateParticipant.mockResolvedValue({
      id: 1,
      email: googlePayload.email,
      is_blocked: 0,
      is_active: 1,
      is_deleted: 1,
    });

    await login();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(respondedWith().message).toMatch(/removed/i);
  });

  it('refuses a blocked account', async () => {
    participantAuthModel.findOrCreateParticipant.mockResolvedValue({
      id: 1,
      email: googlePayload.email,
      is_blocked: 1,
      is_active: 1,
      is_deleted: 0,
    });

    await login();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(respondedWith().message).toMatch(/blocked/i);
  });

  // Without this the account received a working token, then every subsequent
  // request 401'd with "Participant account not found".
  it('refuses an inactive account at sign-in rather than on the next request', async () => {
    participantAuthModel.findOrCreateParticipant.mockResolvedValue({
      id: 1,
      email: googlePayload.email,
      is_blocked: 0,
      is_active: 0,
      is_deleted: 0,
    });

    await login();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(respondedWith().message).toMatch(/inactive/i);
  });

  it('rejects an unverified Google email', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({ ...googlePayload, email_verified: false }),
    });

    await login();

    expect(res.status).toHaveBeenCalledWith(403);
    expect(participantAuthModel.findOrCreateParticipant).not.toHaveBeenCalled();
  });
});
