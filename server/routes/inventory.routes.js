import express from 'express';
import prisma from '../db.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/inventory/stock - Live Stock Inventory
router.get('/stock', verifyToken, async (req, res) => {
  try {
    const { category, search, status } = req.query;

    const where = { isActive: true };

    if (category && category !== 'All') {
      where.category = { name: category };
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { tamilName: { contains: q } },
        { brand: { contains: q } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    const stockItems = products.map((p) => {
      const stock = parseFloat(p.currentStock);
      const minStock = parseFloat(p.minStock);
      let stockStatus = 'IN_STOCK';
      if (stock <= 0) stockStatus = 'OUT_OF_STOCK';
      else if (stock <= minStock) stockStatus = 'LOW_STOCK';

      return {
        ...p,
        stockStatus,
      };
    });

    const filtered = status && status !== 'ALL'
      ? stockItems.filter((i) => i.stockStatus === status)
      : stockItems;

    return res.json(filtered);
  } catch (err) {
    console.error('Fetch stock error:', err);
    return res.status(500).json({ error: 'Failed to retrieve inventory data.' });
  }
});

// POST /api/inventory/adjust - Authorized Stock Adjustment (Admin & Manager)
router.post('/adjust', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { productId, type = 'ADJUSTMENT', quantityChange, reason } = req.body;

    if (!productId || quantityChange === undefined || isNaN(quantityChange)) {
      return res.status(400).json({ error: 'Product ID and valid quantity change are required.' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason for stock adjustment is mandatory.' });
    }

    const prodId = parseInt(productId);
    const delta = parseFloat(quantityChange);

    const product = await prisma.product.findUnique({ where: { id: prodId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const prevStock = parseFloat(product.currentStock);
    const newStock = Math.max(0, prevStock + delta);

    const result = await prisma.$transaction([
      prisma.product.update({
        where: { id: prodId },
        data: { currentStock: newStock },
      }),
      prisma.stockMovement.create({
        data: {
          productId: prodId,
          type: type || 'ADJUSTMENT',
          quantityChange: delta,
          previousStock: prevStock,
          newStock,
          reason: reason.trim(),
          userId: req.user.id,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'STOCK_ADJUSTMENT',
          entity: 'PRODUCT',
          entityId: String(prodId),
          details: `Adjusted stock for ${product.name} by ${delta} (${prevStock} -> ${newStock}). Reason: ${reason.trim()}`,
        },
      }),
    ]);

    return res.json({
      message: 'Stock adjusted successfully',
      product: result[0],
      movement: result[1],
    });
  } catch (err) {
    console.error('Stock adjust error:', err);
    return res.status(500).json({ error: 'Failed to adjust stock.' });
  }
});

// GET /api/inventory/movements - Stock Movement Ledger
router.get('/movements', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { productId, type, limit = 100 } = req.query;

    const where = {};
    if (productId) where.productId = parseInt(productId);
    if (type && type !== 'ALL') where.type = type;

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, tamilName: true, unit: true } },
        user: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    return res.json(movements);
  } catch (err) {
    console.error('Fetch movements error:', err);
    return res.status(500).json({ error: 'Failed to fetch stock movement history.' });
  }
});

export default router;
