import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface DecodedToken extends jwt.JwtPayload {
  userId?: number;
  id?: number;
  email: string;
  name: string;
  isAdmin: boolean;
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        message: 'Authentication required',
        shouldLogout: true,
      });
    }

    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not defined");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as DecodedToken;

    // Map userId to id for consistency
    req.user = {
      id: (decoded.userId || decoded.id)!, // Handle both userId and id
      email: decoded.email,
      name: decoded.name,
      isAdmin: decoded.isAdmin,
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expired',
        shouldLogout: true,
        tokenExpired: true,
      });
    }
    return res.status(401).json({
      message: 'Invalid token',
      shouldLogout: true,
    });
  }
};

export const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        message: 'Authentication required',
        shouldLogout: true,
      });
    }

    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not defined");
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as DecodedToken;

    // Check if user has admin privileges
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    console.error('Token validation error:', error);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expired',
        shouldLogout: true,
        tokenExpired: true,
      });
    }
    return res.status(401).json({
      message: 'Invalid token',
      shouldLogout: true,
    });
  }
};
