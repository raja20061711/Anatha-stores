import express from 'express';
import prisma from '../db.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/customers - Search & List customers
router.get('/', verifyToken, async (req, res) => {
  try {
    const { search } = req.query;
    const where = { isActive: true };

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        _count: { select: { sales: true } },
      },
      orderBy: { name: 'asc' },
      take: 50,
    });

    return res.json(customers);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to search customers' });
  }
});

// POST /api/customers - Add customer (Cashier, Manager, Admin)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    if (!name || !name.trim() || !phone || !phone.trim()) {
      return res.status(400).json({ error: 'Customer name and phone number are required.' });
    }

    const cleanPhone = phone.trim();

    // Check duplicate phone
    const existing = await prisma.customer.findUnique({
      where: { phone: cleanPhone },
    });
    if (existing) {
      return res.status(400).json({ error: `Customer with mobile ${cleanPhone} already exists.` });
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: cleanPhone,
        address: address?.trim() || null,
        loyaltyBalance: 0,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CUSTOMER_CREATED',
        entity: 'CUSTOMER',
        entityId: String(customer.id),
        details: `Registered customer ${customer.name} (${customer.phone})`,
      },
    });

    return res.status(201).json(customer);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to register customer' });
  }
});

// PUT /api/customers/:id - Edit customer
router.put('/:id', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, phone, address, isActive } = req.body;

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: name?.trim(),
        phone: phone?.trim(),
        address: address?.trim(),
        isActive: isActive !== undefined ? isActive : undefined,
      },
    });

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update customer' });
  }
});

// GET /api/customers/:id/history - Purchase History and Loyalty Ledger
router.get('/:id/history', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const [customer, sales, loyaltyTxs] = await Promise.all([
      prisma.customer.findUnique({ where: { id } }),
      prisma.sale.findMany({
        where: { customerId: id },
        include: { items: true, cashier: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.loyaltyTransaction.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    return res.json({
      customer,
      sales,
      loyaltyTxs,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch customer history' });
  }
});

export default router;
