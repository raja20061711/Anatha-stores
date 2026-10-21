import express from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../db.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();
const BACKUP_DIR = path.resolve('server/backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// GET /api/settings - Fetch system and loyalty settings
router.get('/', verifyToken, async (req, res) => {
  try {
    let [appSettings, loyaltySettings] = await Promise.all([
      prisma.applicationSettings.findFirst(),
      prisma.loyaltySettings.findFirst(),
    ]);

    if (!appSettings) {
      appSettings = await prisma.applicationSettings.create({ data: { id: 1 } });
    }
    if (!loyaltySettings) {
      loyaltySettings = await prisma.loyaltySettings.create({ data: { id: 1 } });
    }

    return res.json({ appSettings, loyaltySettings });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// PUT /api/settings/general - Update Store General Details (Admin only)
router.put('/general', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { shopName, address, phone, currency, receiptSize, taxPercentage } = req.body;

    const updated = await prisma.applicationSettings.upsert({
      where: { id: 1 },
      update: {
        shopName: shopName?.trim(),
        address: address?.trim(),
        phone: phone?.trim(),
        currency: currency || '₹',
        receiptSize: receiptSize || '85mm',
        taxPercentage: taxPercentage !== undefined ? parseFloat(taxPercentage) : 0,
      },
      create: {
        id: 1,
        shopName: shopName || 'ANANTHA STORES',
        address: address || 'Main Bazaar',
        phone: phone || '+91 98765 43210',
        currency: currency || '₹',
        receiptSize: receiptSize || '85mm',
        taxPercentage: taxPercentage ? parseFloat(taxPercentage) : 0,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'SETTINGS_GENERAL_UPDATE',
        entity: 'APPLICATION_SETTINGS',
        details: `Updated store profile: ${updated.shopName}, Phone: ${updated.phone}`,
      },
    });

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update general settings' });
  }
});

// PUT /api/settings/price-override - Configure Cashier Price Override Rules (Admin only)
router.put('/price-override', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { enableCashierPriceOverride, requireOverrideReason, minAllowedPricePercentage, zeroPriceAllowed } = req.body;

    const updated = await prisma.applicationSettings.update({
      where: { id: 1 },
      data: {
        enableCashierPriceOverride: Boolean(enableCashierPriceOverride),
        requireOverrideReason: Boolean(requireOverrideReason),
        minAllowedPricePercentage: parseFloat(minAllowedPricePercentage) || 50,
        zeroPriceAllowed: Boolean(zeroPriceAllowed),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'SETTINGS_PRICE_RULES_UPDATE',
        entity: 'APPLICATION_SETTINGS',
        details: `Updated price override settings: Cashier Override=${updated.enableCashierPriceOverride}, Min%=${updated.minAllowedPricePercentage}%`,
      },
    });

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update price override rules' });
  }
});

// PUT /api/settings/loyalty - Configure Loyalty Rules (Admin only)
router.put('/loyalty', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { isEnabled, minPurchaseAmount, pointsPerAmount, pointsRedemptionValue, minRedemptionPoints } = req.body;

    const updated = await prisma.loyaltySettings.upsert({
      where: { id: 1 },
      update: {
        isEnabled: Boolean(isEnabled),
        minPurchaseAmount: parseFloat(minPurchaseAmount) || 100,
        pointsPerAmount: parseFloat(pointsPerAmount) || 5,
        pointsRedemptionValue: parseFloat(pointsRedemptionValue) || 1,
        minRedemptionPoints: parseFloat(minRedemptionPoints) || 10,
      },
      create: {
        id: 1,
        isEnabled: Boolean(isEnabled),
        minPurchaseAmount: parseFloat(minPurchaseAmount) || 100,
        pointsPerAmount: parseFloat(pointsPerAmount) || 5,
        pointsRedemptionValue: parseFloat(pointsRedemptionValue) || 1,
        minRedemptionPoints: parseFloat(minRedemptionPoints) || 10,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'SETTINGS_LOYALTY_UPDATE',
        entity: 'LOYALTY_SETTINGS',
        details: `Updated loyalty rules: Enabled=${updated.isEnabled}, Points=${updated.pointsPerAmount}/100, Value=₹${updated.pointsRedemptionValue}`,
      },
    });

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update loyalty settings' });
  }
});

// GET /api/settings/audit-logs - View Audit Trail (Admin only)
router.get('/audit-logs', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { action, limit = 100 } = req.query;
    const where = {};
    if (action && action !== 'ALL') where.action = action;

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
    });

    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /api/settings/price-history - View Master Price History (Admin only)
router.get('/price-history', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const history = await prisma.priceHistory.findMany({
      include: {
        product: { select: { id: true, name: true, tamilName: true } },
        changedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.json(history);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

// POST /api/settings/backup - Create Database Backup (Admin only)
router.post('/backup', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const [users, products, categories, suppliers, purchases, customers, sales, settings] = await Promise.all([
      prisma.user.findMany(),
      prisma.product.findMany(),
      prisma.category.findMany(),
      prisma.supplier.findMany(),
      prisma.purchase.findMany({ include: { items: true } }),
      prisma.customer.findMany(),
      prisma.sale.findMany({ include: { items: true, payments: true } }),
      prisma.applicationSettings.findFirst(),
    ]);

    const backupData = {
      backupTimestamp: new Date().toISOString(),
      backupVersion: '1.0.0',
      database: 'anatha_stores_db',
      data: {
        users,
        categories,
        products,
        suppliers,
        purchases,
        customers,
        sales,
        settings,
      },
    };

    const fileName = `anantha_store_backup_${Date.now()}.json`;
    const filePath = path.join(BACKUP_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');

    const stats = fs.statSync(filePath);

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DATABASE_BACKUP_CREATED',
        entity: 'DATABASE',
        details: `Created backup file ${fileName} (${Math.round(stats.size / 1024)} KB)`,
      },
    });

    return res.status(201).json({
      message: 'Database backup created successfully',
      fileName,
      sizeBytes: stats.size,
      sizeKb: (stats.size / 1024).toFixed(1),
      timestamp: backupData.backupTimestamp,
    });
  } catch (err) {
    console.error('Backup error:', err);
    return res.status(500).json({ error: 'Failed to create database backup: ' + err.message });
  }
});

// GET /api/settings/backups - List Existing Backups (Admin only)
router.get('/backups', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backupList = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          fileName: f,
          sizeBytes: stats.size,
          sizeKb: (stats.size / 1024).toFixed(1),
          createdAt: stats.birthtime,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json(backupList);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to list backups' });
  }
});

export default router;
