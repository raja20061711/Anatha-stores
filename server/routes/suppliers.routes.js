import express from 'express';
import prisma from '../db.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/suppliers - List suppliers (Admin & Manager)
router.get('/', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: { select: { purchases: true } },
      },
      orderBy: { name: 'asc' },
    });
    return res.json(suppliers);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

// POST /api/suppliers - Add supplier (Admin only)
router.post('/', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { name, contactPerson, phone, email, address } = req.body;

    if (!name || !name.trim() || !phone || !phone.trim()) {
      return res.status(400).json({ error: 'Supplier name and phone number are required.' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        contactPerson: contactPerson?.trim() || null,
        phone: phone.trim(),
        email: email?.trim() || null,
        address: address?.trim() || null,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'SUPPLIER_CREATED',
        entity: 'SUPPLIER',
        entityId: String(supplier.id),
        details: `Created supplier: ${supplier.name} (${supplier.phone})`,
      },
    });

    return res.status(201).json(supplier);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create supplier' });
  }
});

// PUT /api/suppliers/:id - Update supplier (Admin only)
router.put('/:id', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, contactPerson, phone, email, address, isActive } = req.body;

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name: name?.trim(),
        contactPerson: contactPerson?.trim(),
        phone: phone?.trim(),
        email: email?.trim(),
        address: address?.trim(),
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update supplier' });
  }
});

export default router;
