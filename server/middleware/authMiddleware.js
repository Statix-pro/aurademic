import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        message: 'Authentication required',
        shouldLogout: true,
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Map userId to id for consistency
    req.user = {
      id: decoded.userId || decoded.id, // Handle both userId and id
      email: decoded.email,
      name: decoded.name,
      isAdmin: decoded.isAdmin,
    };

    next();
  } catch (error) {
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

export const adminAuthMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        message: 'Authentication required',
        shouldLogout: true,
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user has admin privileges
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = decoded;
    next();
  } catch (error) {
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
