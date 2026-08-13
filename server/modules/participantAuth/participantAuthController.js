import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

import participantAuthModel from './participantAuthModel.js';
import {
  PARTICIPANT_TOKEN_AUDIENCE,
  PARTICIPANT_TOKEN_TTL,
  getParticipantGoogleClientId,
  getParticipantJwtSecret,
} from '../../config/participantAuth.js';

// Resolved on first sign-in rather than at import time: a missing participant
// OAuth var must not stop the shared server (and with it the whole staff portal)
// from booting. getParticipantGoogleClientId throws if it is unset, so the
// failure surfaces here as a 500 on login and never as a skipped audience check.
let googleClient = null;

const getGoogleClient = () => {
  if (!googleClient) {
    googleClient = new OAuth2Client(getParticipantGoogleClientId());
  }

  return googleClient;
};

const buildParticipantToken = (participant) =>
  jwt.sign(
    {
      participantId: participant.id,
      email: participant.email,
    },
    getParticipantJwtSecret(),
    { expiresIn: PARTICIPANT_TOKEN_TTL, audience: PARTICIPANT_TOKEN_AUDIENCE },
  );

const toParticipantResponse = (participant) => ({
  id: participant.id,
  email: participant.email,
  name: participant.name,
  picture: participant.picture,
  profileComplete: Boolean(
    participant.personal_completed_at && participant.profession_completed_at,
  ),
  personalComplete: Boolean(participant.personal_completed_at),
  professionComplete: Boolean(participant.profession_completed_at),
});

const participantAuthController = {
  // Unlike staff login this accepts any Google account, not just @ksrct.ac.in.
  async googleLogin(req, res) {
    try {
      const { credential } = req.body;

      if (!credential) {
        return res.status(400).json({ success: false, message: 'No Google credential provided' });
      }

      // Resolved outside the verify try/catch: a missing client id is a
      // deployment fault, and must not be reported to the caller as a bad token.
      const clientId = getParticipantGoogleClientId();

      let payload;

      try {
        const ticket = await getGoogleClient().verifyIdToken({
          idToken: credential,
          audience: clientId,
        });
        payload = ticket.getPayload();
      } catch (verifyError) {
        console.error('Participant Google token verification failed:', verifyError);
        return res.status(401).json({ success: false, message: 'Invalid Google token' });
      }

      if (!payload?.email) {
        return res.status(400).json({ success: false, message: 'Google account has no email' });
      }

      // Google marks unverified addresses; accepting them would let someone
      // register under an email they do not control.
      if (payload.email_verified === false) {
        return res.status(403).json({
          success: false,
          message: 'Your Google account email is not verified',
        });
      }

      const participant = await participantAuthModel.findOrCreateParticipant({
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        picture: payload.picture || null,
        googleSub: payload.sub,
        emailVerified: payload.email_verified !== false,
      });

      if (!participant) {
        return res.status(500).json({ success: false, message: 'Could not create participant' });
      }

      // These three mirror what participantAuthMiddleware enforces on every
      // later request. Checking them here too means a barred account is told why
      // at sign-in, instead of receiving a working token and then failing every
      // call with a misleading "account not found".
      if (participant.is_deleted) {
        return res.status(403).json({
          success: false,
          message: 'This account has been removed. Contact the event organisers.',
        });
      }

      if (participant.is_blocked) {
        return res.status(403).json({
          success: false,
          message: 'This account has been blocked. Contact the event organisers.',
        });
      }

      if (!participant.is_active) {
        return res.status(403).json({
          success: false,
          message: 'This account is inactive. Contact the event organisers.',
        });
      }

      return res.json({
        success: true,
        data: {
          token: buildParticipantToken(participant),
          participant: toParticipantResponse(participant),
        },
      });
    } catch (error) {
      console.error('Participant authentication error:', error);
      return res.status(500).json({ success: false, message: 'Authentication failed' });
    }
  },

  // Lets the event site restore a session on reload without re-running OAuth.
  async me(req, res) {
    try {
      const participant = await participantAuthModel.findParticipantWithProfileById(
        req.participant.id,
      );

      if (!participant) {
        return res.status(404).json({ success: false, message: 'Participant not found' });
      }

      return res.json({ success: true, data: { participant: toParticipantResponse(participant) } });
    } catch (error) {
      console.error('Failed to load participant session:', error);
      return res.status(500).json({ success: false, message: 'Could not load session' });
    }
  },
};

export default participantAuthController;
