import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'anatha_stores_jwt_super_secure_secret_pos_key_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const trimmedUsername = username.trim().toLowerCase();

    // Find user (case-insensitive username check)
    const user = await prisma.user.findFirst({
      where: {
        username: trimmedUsername,
      },
    });

    if (!user) {
      // Audit log failed attempt
      await prisma.auditLog.create({
        data: {
          action: 'LOGIN_FAILED',
          entity: 'USER',
          details: `Failed login attempt for nonexistent user: ${trimmedUsername}`,
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      }).catch(() => {});

      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Check account active state
    if (!user.isActive) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_BLOCKED_DEACTIVATED',
          entity: 'USER',
          details: `Deactivated user attempt: ${user.username}`,
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      }).catch(() => {});

      return res.status(403).json({ error: 'This account is deactivated. Please contact the administrator.' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_FAILED_PASSWORD',
          entity: 'USER',
          details: `Incorrect password for user: ${user.username}`,
          ipAddress: req.ip || req.socket.remoteAddress,
        },
      }).catch(() => {});

      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Audit log successful login
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entity: 'USER',
        entityId: String(user.id),
        details: `User ${user.fullName} (${user.role}) logged in successfully.`,
        ipAddress: req.ip || req.socket.remoteAddress,
      },
    }).catch(() => {});

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// GET /api/auth/me - Verify and return current authenticated user
router.get('/me', verifyToken, async (req, res) => {
  return res.status(200).json({
    user: req.user,
  });
});

// POST /api/auth/logout - Record logout
router.post('/logout', verifyToken, async (req, res) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'LOGOUT',
        entity: 'USER',
        entityId: String(req.user.id),
        details: `User ${req.user.fullName} logged out.`,
        ipAddress: req.ip || req.socket.remoteAddress,
      },
    }).catch(() => {});

    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (err) {
    return res.status(200).json({ message: 'Logged out.' });
  }
});

export default router;
