import express from 'express';
import prisma from '../db.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import {
  isWeightBased,
  isLiquidBased,
  getPriceBasis,
  getCanonicalPrice,
  convertToCanonical,
  roundMoney,
  roundPrecision,
} from '../utils/unitCalc.js';

const router = express.Router();

// Helper to generate sequential bill number: AS000142
async function generateBillNumber() {
  const count = await prisma.sale.count();
  const nextNum = (count + 1).toString().padStart(6, '0');
  return `AS${nextNum}`;
}

// POST /api/sales/checkout - Complete Bill & Checkout with Transaction Safety
router.post('/checkout', verifyToken, async (req, res) => {
  try {
    const {
      customerId,
      items, // [{ productId, quantity, unit, selectedQuantity, selectedUnit, billedRate, overrideReason }]
      discountTotal = 0,
      paymentMethod = 'CASH',
      amountReceived = 0,
      notes,
      redeemedPoints = 0,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart cannot be empty for checkout.' });
    }

    // 1. Fetch products from DB to validate stock and default prices
    const productIds = items.map((i) => i.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    // 2. Load Application Settings & Loyalty Settings
    const appSettings = (await prisma.applicationSettings.findFirst()) || {
      enableCashierPriceOverride: true,
      requireOverrideReason: true,
      minAllowedPricePercentage: 50,
      zeroPriceAllowed: false,
    };

    const loyaltySettings = (await prisma.loyaltySettings.findFirst()) || {
      isEnabled: true,
      minPurchaseAmount: 100,
      pointsPerAmount: 5,
      pointsRedemptionValue: 1,
      minRedemptionPoints: 10,
    };

    // 3. Validation loop
    let calculatedSubtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const p = productMap.get(item.productId);
      if (!p) {
        return res.status(400).json({ error: `Product ID ${item.productId} not found.` });
      }

      if (!p.isActive) {
        return res.status(400).json({ error: `Product "${p.name}" is deactivated.` });
      }

      // Validate quantity and convert to canonical unit
      const rawQty = item.quantity !== undefined ? item.quantity : item.selectedQuantity;
      const numQty = parseFloat(rawQty);
      if (isNaN(numQty) || numQty <= 0) {
        return res.status(400).json({ error: `Invalid quantity for "${p.name}".` });
      }

      const inputUnit = item.unit || item.selectedUnit || p.baseUnit || p.unit;
      let conversion;
      try {
        conversion = convertToCanonical(rawQty, inputUnit, p.measurementType);
      } catch (convErr) {
        return res.status(400).json({ error: `Invalid quantity or unit for "${p.name}": ${convErr.message}` });
      }

      const { canonicalQty, canonicalUnit, selectedQty, selectedUnit } = conversion;

      // Check stock in canonical unit (e.g. kg, pcs, l)
      const stock = parseFloat(p.currentStock);
      if (stock < canonicalQty) {
        return res.status(400).json({
          error: `Insufficient stock for "${p.name}". Available: ${stock} ${canonicalUnit}, Requested: ${selectedQty} ${selectedUnit} (${canonicalQty} ${canonicalUnit})`,
        });
      }

      // Default rate per canonical unit (Price per KG for weight-based, or Selling Price)
      const defaultRate = getCanonicalPrice(p);
      let billedRate = item.billedRate !== undefined && !isNaN(parseFloat(item.billedRate))
        ? parseFloat(item.billedRate)
        : defaultRate;

      if (isNaN(billedRate) || billedRate < 0) {
        return res.status(400).json({ error: `Invalid rate for "${p.name}".` });
      }

      const isOverridden = Math.abs(billedRate - defaultRate) > 0.001;

      // Price override validation rules
      if (isOverridden) {
        if (!appSettings.enableCashierPriceOverride && req.user.role === 'CASHIER') {
          return res.status(403).json({ error: 'Cashier rate changes are currently disabled by Admin.' });
        }

        if (billedRate === 0 && !appSettings.zeroPriceAllowed) {
          return res.status(400).json({ error: 'Zero-price billing is not permitted by store policy.' });
        }

        const minPermitted = (defaultRate * parseFloat(appSettings.minAllowedPricePercentage)) / 100;
        if (billedRate < minPermitted) {
          return res.status(400).json({
            error: `Rate ₹${billedRate} is below the minimum allowed rate of ₹${minPermitted.toFixed(2)} (${appSettings.minAllowedPricePercentage}% of default).`,
          });
        }

        if (appSettings.requireOverrideReason && (!item.overrideReason || !item.overrideReason.trim())) {
          return res.status(400).json({ error: `Reason is required for changing rate of "${p.name}".` });
        }
      }

      // Calculate line total accurately using integer paise rounding
      const lineTotal = roundMoney(canonicalQty * billedRate);
      calculatedSubtotal = roundMoney(calculatedSubtotal + lineTotal);

      validatedItems.push({
        productId: p.id,
        productName: p.name,
        quantity: canonicalQty, // Canonical quantity stored in DB
        measurementType: p.measurementType || (isWeightBased(p) ? 'KG' : isLiquidBased(p) ? 'L' : 'PCS'),
        unit: selectedUnit || p.unit || 'pcs',
        selectedQuantity: selectedQty,
        selectedUnit: selectedUnit,
        canonicalQuantity: canonicalQty,
        canonicalUnit: canonicalUnit,
        priceBasis: getPriceBasis(p),
        unitPrice: billedRate,
        originalRate: defaultRate,
        billedRate,
        isOverridden,
        overrideReason: isOverridden ? item.overrideReason?.trim() : null,
        lineTotal,
        previousStock: stock,
        newStock: roundPrecision(stock - canonicalQty, 4),
      });
    }

    // 4. Validate customer and points if customer provided
    let customer = null;
    let loyaltyDiscount = 0;
    if (customerId) {
      customer = await prisma.customer.findUnique({ where: { id: parseInt(customerId) } });
      if (customer && loyaltySettings.isEnabled && redeemedPoints > 0) {
        const availableBalance = parseFloat(customer.loyaltyBalance);
        if (redeemedPoints > availableBalance) {
          return res.status(400).json({ error: 'Redeemed points exceed available balance.' });
        }
        if (redeemedPoints < parseFloat(loyaltySettings.minRedemptionPoints)) {
          return res.status(400).json({
            error: `Minimum ${loyaltySettings.minRedemptionPoints} points required for redemption.`,
          });
        }
        loyaltyDiscount = redeemedPoints * parseFloat(loyaltySettings.pointsRedemptionValue);
      }
    }

    const discount = parseFloat(discountTotal) || 0;
    const totalDiscount = discount + loyaltyDiscount;
    const grandTotal = Math.max(0, roundMoney(calculatedSubtotal - totalDiscount));

    const received = paymentMethod === 'CASH' ? parseFloat(amountReceived) || 0 : grandTotal;
    if (paymentMethod === 'CASH' && received < grandTotal) {
      return res.status(400).json({
        error: `Insufficient cash received. Grand Total: ₹${grandTotal.toFixed(2)}, Received: ₹${received.toFixed(2)}`,
      });
    }

    const changeAmount = paymentMethod === 'CASH' ? Math.max(0, roundMoney(received - grandTotal)) : 0;
    const billNumber = await generateBillNumber();

    // 5. Calculate Loyalty Points to Earn
    let earnedPoints = 0;
    if (customer && loyaltySettings.isEnabled && grandTotal >= parseFloat(loyaltySettings.minPurchaseAmount)) {
      const qualifyingUnits = Math.floor(grandTotal / 100);
      earnedPoints = qualifyingUnits * parseFloat(loyaltySettings.pointsPerAmount);
    }

    // 6. Execute atomic database transaction
    const result = await prisma.$transaction(async (tx) => {
      // A. Create Sale record
      const sale = await tx.sale.create({
        data: {
          billNumber,
          cashierId: req.user.id,
          customerId: customer ? customer.id : null,
          subtotal: calculatedSubtotal,
          discountTotal: totalDiscount,
          taxTotal: 0,
          grandTotal,
          paymentMethod,
          amountReceived: received,
          changeAmount,
          notes: notes || null,
        },
      });

      // B. Create Sale Items & Reduce Stock & Add Stock Movement
      for (const item of validatedItems) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            measurementType: item.measurementType,
            unit: item.unit,
            selectedQuantity: item.selectedQuantity,
            selectedUnit: item.selectedUnit,
            canonicalQuantity: item.canonicalQuantity,
            canonicalUnit: item.canonicalUnit,
            priceBasis: item.priceBasis,
            unitPrice: item.unitPrice,
            originalRate: item.originalRate,
            billedRate: item.billedRate,
            isOverridden: item.isOverridden,
            overrideReason: item.overrideReason,
            lineTotal: item.lineTotal,
          },
        });

        // Reduce stock in canonical unit exactly once
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: item.newStock },
        });

        // Record stock movement
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'SALE',
            quantityChange: -item.quantity, // negative canonical quantity
            previousStock: item.previousStock,
            newStock: item.newStock,
            reason: `Sold on bill #${billNumber}`,
            userId: req.user.id,
            referenceId: billNumber,
          },
        });

        // If price was overridden, log to audit log
        if (item.isOverridden) {
          await tx.auditLog.create({
            data: {
              userId: req.user.id,
              action: 'PRICE_OVERRIDE_BILL',
              entity: 'SALE_ITEM',
              entityId: `${billNumber}-${item.productId}`,
              details: `Rate overridden for ${item.productName} from default ₹${item.originalRate} to ₹${item.billedRate} on bill #${billNumber}. Reason: ${item.overrideReason || 'N/A'}`,
            },
          });
        }
      }

      // C. Record Payment
      await tx.payment.create({
        data: {
          saleId: sale.id,
          paymentMethod,
          amount: grandTotal,
          reference: paymentMethod !== 'CASH' ? `TXN-${billNumber}` : null,
        },
      });

      // D. Handle Loyalty Transactions if applicable
      if (customer && loyaltySettings.isEnabled) {
        let currentBal = parseFloat(customer.loyaltyBalance);

        // Deduct redeemed points
        if (redeemedPoints > 0) {
          currentBal -= redeemedPoints;
          await tx.loyaltyTransaction.create({
            data: {
              customerId: customer.id,
              saleId: sale.id,
              type: 'REDEEM',
              points: -redeemedPoints,
              balanceAfter: currentBal,
              notes: `Redeemed on bill #${billNumber}`,
            },
          });
        }

        // Add earned points
        if (earnedPoints > 0) {
          currentBal += earnedPoints;
          await tx.loyaltyTransaction.create({
            data: {
              customerId: customer.id,
              saleId: sale.id,
              type: 'EARN',
              points: earnedPoints,
              balanceAfter: currentBal,
              notes: `Earned on bill #${billNumber}`,
            },
          });
        }

        // Update customer balance
        await tx.customer.update({
          where: { id: customer.id },
          data: { loyaltyBalance: currentBal },
        });
      }

      // E. Audit Log sale creation
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'SALE_COMPLETED',
          entity: 'SALE',
          entityId: String(sale.id),
          details: `Bill #${billNumber} completed for ₹${grandTotal.toFixed(2)} by ${req.user.fullName} (${paymentMethod})`,
        },
      });

      return sale;
    });

    // Return the completed sale with populated items & cashier
    const fullSale = await prisma.sale.findUnique({
      where: { id: result.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, tamilName: true, unit: true, measurementType: true, baseUnit: true, pricePerKg: true, sellingPrice: true } },
          },
        },
        cashier: { select: { id: true, fullName: true, username: true } },
        customer: true,
        payments: true,
      },
    });

    return res.status(201).json({
      message: 'Sale completed successfully',
      sale: fullSale,
      earnedPoints,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Checkout failed. Transaction rolled back: ' + err.message });
  }
});

// GET /api/sales - Search & List Sales History
router.get('/', verifyToken, async (req, res) => {
  try {
    const { billNumber, cashierId, customerId, paymentMethod, startDate, endDate, page = 1, limit = 50 } = req.query;

    const where = {};

    // Cashiers can only view their own bills unless permitted
    if (req.user.role === 'CASHIER') {
      where.cashierId = req.user.id;
    } else if (cashierId) {
      where.cashierId = parseInt(cashierId);
    }

    if (billNumber) {
      where.billNumber = { contains: billNumber.trim() };
    }

    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    if (paymentMethod && paymentMethod !== 'ALL') {
      where.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [sales, totalCount] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          cashier: { select: { id: true, fullName: true } },
          customer: { select: { id: true, name: true, phone: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, tamilName: true, unit: true, measurementType: true, baseUnit: true, pricePerKg: true, sellingPrice: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.sale.count({ where }),
    ]);

    return res.json({
      sales,
      totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / take),
    });
  } catch (err) {
    console.error('Fetch sales error:', err);
    return res.status(500).json({ error: 'Failed to retrieve sales records.' });
  }
});

// GET /api/sales/:id - View Bill Details
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, tamilName: true, unit: true, measurementType: true, baseUnit: true, pricePerKg: true, sellingPrice: true } },
          },
        },
        cashier: { select: { id: true, fullName: true, username: true } },
        customer: true,
        payments: true,
      },
    });

    if (!sale) {
      return res.status(404).json({ error: 'Bill not found.' });
    }

    return res.json(sale);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch bill details' });
  }
});

// POST /api/sales/held - Save held bill
router.post('/held', verifyToken, async (req, res) => {
  try {
    const { billData, customerName, totalAmount } = req.body;
    const held = await prisma.heldBill.create({
      data: {
        billData: typeof billData === 'string' ? billData : JSON.stringify(billData),
        customerName: customerName || null,
        totalAmount: totalAmount || 0,
        cashierId: req.user.id,
      },
    });
    return res.status(201).json(held);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to hold bill' });
  }
});

// GET /api/sales/held - List held bills for cashier
router.get('/held/list', verifyToken, async (req, res) => {
  try {
    const held = await prisma.heldBill.findMany({
      where: { cashierId: req.user.id },
      orderBy: { heldAt: 'desc' },
    });
    return res.json(held);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch held bills' });
  }
});

// DELETE /api/sales/held/:id - Delete restored or discarded held bill
router.delete('/held/:id', verifyToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.heldBill.delete({ where: { id } });
    return res.json({ message: 'Held bill removed' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to remove held bill' });
  }
});

export default router;
