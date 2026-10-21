import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// All staff endpoints are strictly ADMIN ONLY
router.use(verifyToken, requireRole(['ADMIN']));

// GET /api/staff - List all staff accounts
router.get('/', async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { sales: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(staff);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve staff accounts' });
  }
});

// POST /api/staff - Create Manager or Cashier
router.post('/', async (req, res) => {
  try {
    const { fullName, username, password, role } = req.body;

    if (!fullName || !username || !password || !role) {
      return res.status(400).json({ error: 'All fields are required (fullName, username, password, role).' });
    }

    if (!['MANAGER', 'CASHIER'].includes(role)) {
      return res.status(400).json({ error: 'Role must be MANAGER or CASHIER.' });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check duplicate username
    const existing = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });
    if (existing) {
      return res.status(400).json({ error: `Username "${cleanUsername}" is already taken.` });
    }

    const hash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        username: cleanUsername,
        passwordHash: hash,
        role,
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'STAFF_CREATED',
        entity: 'USER',
        entityId: String(newUser.id),
        details: `Admin created ${role} account for ${newUser.fullName} (${newUser.username})`,
      },
    });

    return res.status(201).json(newUser);
  } catch (err) {
    console.error('Create staff error:', err);
    return res.status(500).json({ error: 'Failed to create staff account' });
  }
});

// PUT /api/staff/:id - Update status / role / name
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fullName, role, isActive } = req.body;

    // Prevent deactivating own account
    if (id === req.user.id && isActive === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own administrative account.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        fullName: fullName?.trim(),
        role: role && ['MANAGER', 'CASHIER'].includes(role) ? role : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'STAFF_UPDATED',
        entity: 'USER',
        entityId: String(id),
        details: `Updated staff ${updated.fullName}: Active=${updated.isActive}, Role=${updated.role}`,
      },
    });

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update staff account' });
  }
});

// PUT /api/staff/:id/password - Reset staff password
router.put('/:id/password', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { passwordHash: hash },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'STAFF_PASSWORD_RESET',
        entity: 'USER',
        entityId: String(id),
        details: `Admin reset password for user ID ${id}`,
      },
    });

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
