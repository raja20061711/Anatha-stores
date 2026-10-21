import express from 'express';
import prisma from '../db.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/purchases - List purchase invoices
router.get('/', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { status, supplierId } = req.query;
    const where = {};
    if (status && status !== 'ALL') where.status = status;
    if (supplierId) where.supplierId = parseInt(supplierId);

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        supplier: true,
        items: {
          include: { product: true },
        },
        receivedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(purchases);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve purchases' });
  }
});

// POST /api/purchases - Create purchase order/invoice
router.post('/', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const {
      supplierId,
      invoiceNumber,
      purchaseDate,
      items, // [{ productId, quantity, purchaseCost }]
      status = 'DRAFT',
      paidAmount = 0,
      notes,
    } = req.body;

    if (!supplierId || !invoiceNumber || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Supplier, Invoice #, and items are required.' });
    }

    // Check unique invoice
    const existing = await prisma.purchase.findUnique({
      where: { invoiceNumber: invoiceNumber.trim() },
    });
    if (existing) {
      return res.status(400).json({ error: `Purchase invoice #${invoiceNumber} already exists.` });
    }

    let calculatedTotal = 0;
    const purchaseItemsData = [];

    for (const item of items) {
      const qty = parseFloat(item.quantity);
      const cost = parseFloat(item.purchaseCost);
      if (isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
        return res.status(400).json({ error: 'Invalid quantity or cost in purchase items.' });
      }
      const lineTotal = qty * cost;
      calculatedTotal += lineTotal;

      purchaseItemsData.push({
        productId: parseInt(item.productId),
        quantity: qty,
        purchaseCost: cost,
        lineTotal,
      });
    }

    const paid = parseFloat(paidAmount) || 0;
    const balance = Math.max(0, calculatedTotal - paid);

    const isReceivingNow = status === 'RECEIVED';

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          supplierId: parseInt(supplierId),
          invoiceNumber: invoiceNumber.trim(),
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          totalAmount: calculatedTotal,
          paidAmount: paid,
          balanceAmount: balance,
          status: isReceivingNow ? 'RECEIVED' : 'DRAFT',
          receivedById: isReceivingNow ? req.user.id : null,
          notes: notes || null,
          items: {
            create: purchaseItemsData,
          },
        },
        include: { items: true },
      });

      // If received upon creation, increase stock exactly once
      if (isReceivingNow) {
        for (const item of purchaseItemsData) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          const prev = parseFloat(product.currentStock);
          const next = prev + item.quantity;

          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: next, purchaseCost: item.purchaseCost },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: 'PURCHASE',
              quantityChange: item.quantity,
              previousStock: prev,
              newStock: next,
              reason: `Goods received from purchase invoice #${invoiceNumber}`,
              userId: req.user.id,
              referenceId: invoiceNumber,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: isReceivingNow ? 'PURCHASE_RECEIVED' : 'PURCHASE_DRAFTED',
          entity: 'PURCHASE',
          entityId: String(purchase.id),
          details: `Invoice #${invoiceNumber} for ₹${calculatedTotal.toFixed(2)} (${isReceivingNow ? 'Received & Stock Added' : 'Drafted'})`,
        },
      });

      return purchase;
    });

    return res.status(201).json(result);
  } catch (err) {
    console.error('Purchase creation error:', err);
    return res.status(500).json({ error: 'Failed to record purchase: ' + err.message });
  }
});

// PUT /api/purchases/:id/receive - Confirm Received Goods Workflow
router.put('/:id/receive', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase entry not found.' });
    }

    if (purchase.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Goods have already been confirmed and received for this invoice.' });
    }

    if (purchase.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Cannot receive cancelled purchase invoice.' });
    }

    // Increase stock in a database transaction
    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.update({
        where: { id },
        data: {
          status: 'RECEIVED',
          receivedById: req.user.id,
        },
      });

      for (const item of purchase.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        const prev = parseFloat(product.currentStock);
        const next = prev + parseFloat(item.quantity);

        await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: next,
            purchaseCost: item.purchaseCost,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'PURCHASE',
            quantityChange: parseFloat(item.quantity),
            previousStock: prev,
            newStock: next,
            reason: `Goods confirmed received for invoice #${purchase.invoiceNumber}`,
            userId: req.user.id,
            referenceId: purchase.invoiceNumber,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'PURCHASE_GOODS_CONFIRMED',
          entity: 'PURCHASE',
          entityId: String(id),
          details: `Confirmed and received goods for purchase #${purchase.invoiceNumber}. Stock updated.`,
        },
      });

      return p;
    });

    return res.json({ message: 'Goods confirmed received. Stock increased successfully.', purchase: updated });
  } catch (err) {
    console.error('Receive goods error:', err);
    return res.status(500).json({ error: 'Failed to confirm received goods: ' + err.message });
  }
});

export default router;
