import express from 'express';
import prisma from '../db.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

// GET /api/reports/dashboard - Real Database Aggregated Metrics (Admin & Manager)
router.get('/dashboard', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    const [
      todaySalesAgg,
      todayBillsCount,
      monthSalesAgg,
      totalProducts,
      lowStockProducts,
      totalCustomers,
      recentSales,
      paymentMethodAgg,
    ] = await Promise.all([
      // Today's total sales
      prisma.sale.aggregate({
        _sum: { grandTotal: true },
        where: { createdAt: { gte: todayStart } },
      }),
      // Today's bills count
      prisma.sale.count({
        where: { createdAt: { gte: todayStart } },
      }),
      // Monthly total sales
      prisma.sale.aggregate({
        _sum: { grandTotal: true },
        where: { createdAt: { gte: monthStart } },
      }),
      // Total active products
      prisma.product.count({
        where: { isActive: true },
      }),
      // Low stock count (currentStock <= minStock)
      prisma.$queryRaw`SELECT count(*) as count FROM products WHERE isActive = 1 AND currentStock <= minStock`,
      // Total customers
      prisma.customer.count({
        where: { isActive: true },
      }),
      // Recent transactions
      prisma.sale.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: {
          cashier: { select: { fullName: true } },
          customer: { select: { name: true } },
        },
      }),
      // Payment method breakdown
      prisma.sale.groupBy({
        by: ['paymentMethod'],
        _sum: { grandTotal: true },
        _count: { id: true },
      }),
    ]);

    // 7-day sales trend query
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const weeklySales = await prisma.sale.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, grandTotal: true },
    });

    // Group weekly sales by day
    const trendMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      trendMap[key] = 0;
    }

    for (const s of weeklySales) {
      const key = new Date(s.createdAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      if (trendMap[key] !== undefined) {
        trendMap[key] += parseFloat(s.grandTotal);
      }
    }

    const salesTrend = Object.keys(trendMap).map((date) => ({
      date,
      sales: trendMap[date],
    }));

    const lowStockCount = Number(lowStockProducts[0]?.count || 0);

    return res.json({
      todaySales: parseFloat(todaySalesAgg._sum.grandTotal || 0),
      todayBills: todayBillsCount,
      monthSales: parseFloat(monthSalesAgg._sum.grandTotal || 0),
      totalProducts,
      lowStockCount,
      totalCustomers,
      recentSales,
      paymentMethodBreakdown: paymentMethodAgg.map((p) => ({
        method: p.paymentMethod,
        total: parseFloat(p._sum.grandTotal || 0),
        count: p._count.id,
      })),
      salesTrend,
    });
  } catch (err) {
    console.error('Dashboard report error:', err);
    return res.status(500).json({ error: 'Failed to aggregate dashboard reports: ' + err.message });
  }
});

// GET /api/reports/product-wise - Product-Wise Sales Report
router.get('/product-wise', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.sale = { createdAt: {} };
      if (startDate) where.sale.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.sale.createdAt.lte = end;
      }
    }

    const saleItems = await prisma.saleItem.findMany({
      where,
      select: {
        productId: true,
        productName: true,
        quantity: true,
        lineTotal: true,
      },
    });

    const productMap = {};
    for (const item of saleItems) {
      if (!productMap[item.productId]) {
        productMap[item.productId] = {
          productId: item.productId,
          productName: item.productName,
          totalQty: 0,
          totalRevenue: 0,
        };
      }
      productMap[item.productId].totalQty += parseFloat(item.quantity);
      productMap[item.productId].totalRevenue += parseFloat(item.lineTotal);
    }

    const report = Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
    return res.json(report);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate product-wise sales report' });
  }
});

// GET /api/reports/cashier-wise - Cashier Performance Report
router.get('/cashier-wise', verifyToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const cashiers = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        sales: {
          select: {
            grandTotal: true,
          },
        },
      },
    });

    const report = cashiers.map((c) => {
      const totalSales = c.sales.reduce((sum, s) => sum + parseFloat(s.grandTotal), 0);
      return {
        id: c.id,
        fullName: c.fullName,
        username: c.username,
        role: c.role,
        billCount: c.sales.length,
        totalSales,
      };
    });

    return res.json(report);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate cashier report' });
  }
});

// GET /api/reports/estimated-profit - Estimated Profit (ADMIN ONLY)
router.get('/estimated-profit', verifyToken, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.sale = { createdAt: {} };
      if (startDate) where.sale.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.sale.createdAt.lte = end;
      }
    }

    const saleItems = await prisma.saleItem.findMany({
      where,
      include: {
        product: { select: { purchaseCost: true } },
      },
    });

    let totalRevenue = 0;
    let totalCost = 0;

    for (const item of saleItems) {
      const rev = parseFloat(item.lineTotal);
      const costPerUnit = parseFloat(item.product?.purchaseCost || 0);
      const itemCost = costPerUnit * parseFloat(item.quantity);

      totalRevenue += rev;
      totalCost += itemCost;
    }

    const estimatedProfit = totalRevenue - totalCost;
    const profitMarginPercentage = totalRevenue > 0 ? (estimatedProfit / totalRevenue) * 100 : 0;

    return res.json({
      totalRevenue,
      totalCost,
      estimatedProfit,
      profitMarginPercentage,
      totalItemsSold: saleItems.length,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to calculate profit estimates' });
  }
});

export default router;
