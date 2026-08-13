import jwt from 'jsonwebtoken';

import { PARTICIPANT_TOKEN_AUDIENCE, getParticipantJwtSecret } from '../config/participantAuth.js';
import participantAuthModel from '../modules/participantAuth/participantAuthModel.js';

const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  const [, token] = authHeader.split(' ');

  return token || null;
};

// Mirror of authMiddleware: accepts only participant tokens, never sets req.user.
export const participantAuthMiddleware = async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      shouldLogout: true,
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, getParticipantJwtSecret(), {
      audience: PARTICIPANT_TOKEN_AUDIENCE,
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please sign in again.',
        shouldLogout: true,
        tokenExpired: true,
      });
    }

    // A staff token fails here on audience or signature.
    return res.status(401).json({
      success: false,
      message: 'Invalid participant token',
      shouldLogout: true,
    });
  }

  const participantId = Number(decoded.participantId);

  if (!Number.isInteger(participantId) || participantId <= 0) {
    return res.status(401).json({
      success: false,
      message: 'Invalid participant token',
      shouldLogout: true,
    });
  }

  // Re-read each request so a block takes effect before the token expires.
  let participant;

  try {
    participant = await participantAuthModel.findActiveParticipantById(participantId);
  } catch (error) {
    console.error('Failed to load participant for request:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not verify participant',
    });
  }

  if (!participant) {
    return res.status(401).json({
      success: false,
      message: 'Participant account not found',
      shouldLogout: true,
    });
  }

  if (participant.is_blocked) {
    return res.status(403).json({
      success: false,
      message: 'This account has been blocked. Contact the event organisers.',
      shouldLogout: true,
    });
  }

  req.participant = {
    id: participant.id,
    email: participant.email,
    name: participant.name,
  };

  return next();
};

export default participantAuthMiddleware;
