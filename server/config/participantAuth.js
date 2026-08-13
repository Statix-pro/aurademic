import './env.js';

// Public event participants are not staff. Two guards keep them off staff routes:
// a separate signing secret, plus an `aud` claim both middlewares check.
export const PARTICIPANT_TOKEN_AUDIENCE = 'participant';

export const PARTICIPANT_TOKEN_TTL = '12h';

// Falls back to JWT_SECRET in dev only, so a misconfigured production deploy
// fails loudly instead of silently sharing the staff secret.
export const getParticipantJwtSecret = () => {
  const secret = process.env.JWT_PARTICIPANT_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_PARTICIPANT_SECRET is required in production');
  }

  return process.env.JWT_SECRET;
};

export const getParticipantGoogleClientId = () =>
  process.env.GOOGLE_PARTICIPANT_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
