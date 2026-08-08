import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

import authModel from './authModel.js';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Optional institutional domain allow-list. When ALLOWED_EMAIL_DOMAINS is set
// (comma-separated, e.g. "ksrct.ac.in"), only accounts on those domains may log
// in — preventing arbitrary Google/Microsoft accounts from self-provisioning.
const allowedEmailDomains = (process.env.ALLOWED_EMAIL_DOMAINS || '')
  .split(',')
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

const isEmailDomainAllowed = (email) => {
  if (allowedEmailDomains.length === 0) {
    return true; // No allow-list configured: preserve existing behavior.
  }
  const domain = String(email || '')
    .split('@')[1]
    ?.toLowerCase();
  return Boolean(domain) && allowedEmailDomains.includes(domain);
};

const authController = {
  async googleLogin(req, res) {
    try {
      const { credential } = req.body;

      // Confirm if credential is present
      if (!credential) {
        console.error('Missing credential in request body');
        return res.status(400).json({
          error: 'Missing credentials',
          details: 'No Google credential provided in request',
        });
      }

      // Token verification and further processing
      let ticket;
      try {
        ticket = await client.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
      } catch (verifyError) {
        console.error('Token verification failed:', verifyError);
        return res.status(401).json({
          error: 'Invalid token',
        });
      }

      const payload = ticket.getPayload();
      const googleId = payload.sub;

      if (!isEmailDomainAllowed(payload.email)) {
        console.warn('Rejected Google login for disallowed domain:', payload.email);
        return res.status(403).json({ error: 'Account not permitted' });
      }

      // Continue with user creation or update
      const user = await authModel.findOrCreateUser({
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        googleId,
      });

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          isAdmin: user.is_admin,
          isSuperAdmin: user.is_super_admin,
          roles: user.roles || [],
          permissions: user.permissions || [],
          googleId: googleId,
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h', algorithm: 'HS256' },
      );

      return res.json({ token, user });
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(500).json({
        error: 'Authentication failed',
      });
    }
  },

  async microsoftLogin(req, res) {
    try {
      const { accessToken } = req.body;

      if (!accessToken) {
        return res.status(400).json({
          error: 'Missing credentials',
          details: 'No Microsoft access token provided in request',
        });
      }

      // Verify token by calling Microsoft Graph
      let graphProfile;
      try {
        const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!graphResponse.ok) {
          const errorText = await graphResponse.text();
          throw new Error(`Graph API responded ${graphResponse.status}: ${errorText}`);
        }

        graphProfile = await graphResponse.json();
      } catch (verifyError) {
        console.error('Microsoft token verification failed:', verifyError);
        return res.status(401).json({
          error: 'Invalid token',
        });
      }

      const email = graphProfile.mail || graphProfile.userPrincipalName;
      const name = graphProfile.displayName;
      const microsoftId = graphProfile.id;

      if (!email) {
        return res.status(400).json({
          error: 'Invalid Microsoft profile',
        });
      }

      if (!isEmailDomainAllowed(email)) {
        console.warn('Rejected Microsoft login for disallowed domain:', email);
        return res.status(403).json({ error: 'Account not permitted' });
      }

      const user = await authModel.findOrCreateUser({
        email,
        name,
        picture: null,
        microsoftId,
      });

      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          isAdmin: user.is_admin,
          isSuperAdmin: user.is_super_admin,
          roles: user.roles || [],
          permissions: user.permissions || [],
          microsoftId,
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h', algorithm: 'HS256' },
      );

      return res.json({ token, user });
    } catch (error) {
      console.error('Microsoft authentication error:', error);
      return res.status(500).json({
        error: 'Authentication failed',
      });
    }
  },
};

export default authController;
