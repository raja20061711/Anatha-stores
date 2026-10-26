import jwt from 'jsonwebtoken';
import prisma from '../db.js';

export async function verifyToken(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }

    const secret = process.env.JWT_SECRET || 'anatha_stores_jwt_super_secure_secret_pos_key_2026';
    
    const decoded = jwt.verify(token, secret);
    
    // Fetch user from DB to ensure account still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account has been deactivated. Contact Administrator.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: `Access denied. Requires one of [${allowedRoles.join(', ')}] role.`,
        currentRole: req.user.role,
      });
    }

    next();
  };
}
