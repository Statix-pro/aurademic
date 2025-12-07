import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import authModel from './authModel.js';
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
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
            if (!process.env.GOOGLE_CLIENT_ID) {
                throw new Error("GOOGLE_CLIENT_ID not set");
            }
            // Token verification and further processing
            let ticket;
            try {
                ticket = await client.verifyIdToken({
                    idToken: credential,
                    audience: process.env.GOOGLE_CLIENT_ID,
                });
            }
            catch (verifyError) {
                console.error('Token verification failed:', verifyError);
                return res.status(401).json({
                    error: 'Invalid token',
                    details: verifyError.message,
                });
            }
            const payload = ticket.getPayload();
            if (!payload) {
                throw new Error("No payload in ticket");
            }
            const googleId = payload.sub;
            // Continue with user creation or update
            const user = await authModel.findOrCreateUser({
                email: payload.email || '',
                name: payload.name || 'Unknown',
                picture: payload.picture,
            });
            if (!process.env.JWT_SECRET) {
                throw new Error("JWT_SECRET not set");
            }
            const token = jwt.sign({
                userId: user.id,
                email: user.email,
                isAdmin: user.is_admin,
                googleId: googleId,
            }, process.env.JWT_SECRET, { expiresIn: '24h' });
            return res.json({ token, user });
        }
        catch (error) {
            console.error('Authentication error:', error);
            return res.status(500).json({
                error: 'Authentication failed',
                details: error.message,
            });
        }
    },
};
export default authController;
