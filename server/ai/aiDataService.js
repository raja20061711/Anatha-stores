import prisma from '../db.js';

/**
 * Standardized date range resolver for AI queries.
 */
export function resolveDateRange(period = 'today', customStart = null, customEnd = null) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  let currentStart, currentEnd, label;

  switch (period.toLowerCase()) {
    case 'today':
      currentStart = startOfDay(now);
      currentEnd = endOfDay(now);
      label = `Today (${now.toLocaleDateString('en-IN')})`;
      break;

    case 'yesterday': {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      currentStart = startOfDay(y);
      currentEnd = endOfDay(y);
      label = `Yesterday (${y.toLocaleDateString('en-IN')})`;
      break;
    }

    case 'this_week': {
      const day = now.getDay();
      const distance = (day + 6) % 7; // Monday = 0
      const mon = new Date(now);
      mon.setDate(now.getDate() - distance);
      currentStart = startOfDay(mon);
      currentEnd = endOfDay(now);
      label = `This Week (${mon.toLocaleDateString('en-IN')} - ${now.toLocaleDateString('en-IN')})`;
      break;
    }

    case 'last_week': {
      const day = now.getDay();
      const distance = (day + 6) % 7;
      const lastMon = new Date(now);
      lastMon.setDate(now.getDate() - distance - 7);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastMon.getDate() + 6);
      currentStart = startOfDay(lastMon);
      currentEnd = endOfDay(lastSun);
      label = `Last Week (${lastMon.toLocaleDateString('en-IN')} - ${lastSun.toLocaleDateString('en-IN')})`;
      break;
    }

    case 'this_month':
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      currentEnd = endOfDay(now);
      label = `This Month (${now.toLocaleString('default', { month: 'long', year: 'numeric' })})`;
      break;

    case 'last_month': {
      currentStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      currentEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      const lastMonthName = currentStart.toLocaleString('default', { month: 'long', year: 'numeric' });
      label = `Last Month (${lastMonthName})`;
      break;
    }

    case 'this_year':
      currentStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      currentEnd = endOfDay(now);
      label = `This Year (${now.getFullYear()})`;
      break;

    case 'custom':
    default:
      if (customStart && customEnd) {
        currentStart = startOfDay(new Date(customStart));
        currentEnd = endOfDay(new Date(customEnd));
        label = `${currentStart.toLocaleDateString('en-IN')} to ${currentEnd.toLocaleDateString('en-IN')}`;
      } else {
        currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        currentEnd = endOfDay(now);
        label = `This Month (${now.toLocaleString('default', { month: 'long', year: 'numeric' })})`;
      }
      break;
  }

  return { currentStart, currentEnd, label };
}

/**
 * 1. SALES & BILLING INTELLIGENCE
 */
export async function getSalesIntelligence({ period = 'today', startDate, endDate, cashierId, paymentMethod, userRole, userId }) {
  const { currentStart, currentEnd, label } = resolveDateRange(period, startDate, endDate);

  const where = {
    createdAt: {
      gte: currentStart,
      lte: currentEnd,
    },
  };

  // Cashier restriction: cashiers only view their own shift sales unless admin/manager
  if (userRole === 'CASHIER') {
    where.cashierId = userId;
  } else if (cashierId) {
    where.cashierId = Number(cashierId);
  }

  if (paymentMethod) {
    where.paymentMethod = paymentMethod.toUpperCase();
  }

  const [sales, returns] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        cashier: { select: { id: true, fullName: true, username: true } },
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stockMovement.findMany({
      where: {
        type: 'RETURN',
        createdAt: { gte: currentStart, lte: currentEnd },
      },
      include: { product: true },
    }),
  ]);

  let totalGrossSales = 0;
  let totalDiscounts = 0;
  let totalTaxes = 0;
  let totalNetSales = 0;
  const paymentBreakdown = { CASH: 0, UPI: 0, CARD: 0, SPLIT: 0 };
  const hourlySales = {};

  sales.forEach((s) => {
    const grand = parseFloat(s.grandTotal) || 0;
    const sub = parseFloat(s.subtotal) || grand;
    const disc = parseFloat(s.discountTotal) || 0;
    const tax = parseFloat(s.taxTotal) || 0;

    totalGrossSales += sub;
    totalDiscounts += disc;
    totalTaxes += tax;
    totalNetSales += grand;

    if (paymentBreakdown[s.paymentMethod] !== undefined) {
      paymentBreakdown[s.paymentMethod] += grand;
    } else {
      paymentBreakdown[s.paymentMethod] = grand;
    }

    const hour = new Date(s.createdAt).getHours();
    const hourLabel = `${hour.toString().padStart(2, '0')}:00`;
    hourlySales[hourLabel] = (hourlySales[hourLabel] || 0) + grand;
  });

  const totalBills = sales.length;
  const averageBillValue = totalBills > 0 ? Number((totalNetSales / totalBills).toFixed(2)) : 0;

  // Determine peak sales hours
  const peakHours = Object.entries(hourlySales)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hr, val]) => ({ hour: hr, amount: Number(val.toFixed(2)) }));

  // Returns calculation
  const totalReturnUnits = returns.reduce((sum, r) => sum + Math.abs(parseFloat(r.quantityChange) || 0), 0);
  const totalReturnAmount = returns.reduce((sum, r) => {
    const price = parseFloat(r.product?.sellingPrice) || 0;
    return sum + (Math.abs(parseFloat(r.quantityChange) || 0) * price);
  }, 0);

  return {
    period: label,
    dateRange: { start: currentStart.toISOString(), end: currentEnd.toISOString() },
    totalBills,
    grossSales: Number(totalGrossSales.toFixed(2)),
    discountsGiven: Number(totalDiscounts.toFixed(2)),
    taxCollected: Number(totalTaxes.toFixed(2)),
    netSales: Number(totalNetSales.toFixed(2)),
    averageBillValue,
    paymentBreakdown: Object.entries(paymentBreakdown).map(([method, amount]) => ({
      method,
      amount: Number(amount.toFixed(2)),
      percentage: totalNetSales > 0 ? Number(((amount / totalNetSales) * 100).toFixed(1)) : 0,
    })),
    peakHours,
    hourlyDistribution: Object.entries(hourlySales).map(([hour, amount]) => ({ hour, amount: Number(amount.toFixed(2)) })),
    returns: {
      count: returns.length,
      units: Number(totalReturnUnits.toFixed(3)),
      estimatedValue: Number(totalReturnAmount.toFixed(2)),
    },
    userRole,
  };
}

/**
 * 2. PRODUCT & INVENTORY INTELLIGENCE
 */
export async function getTopSellingProducts({ period = 'this_month', startDate, endDate, limit = 10, categoryId, userRole }) {
  const { currentStart, currentEnd, label } = resolveDateRange(period, startDate, endDate);

  const saleWhere = {
    createdAt: { gte: currentStart, lte: currentEnd },
  };

  const saleItems = await prisma.saleItem.findMany({
    where: {
      sale: saleWhere,
    },
    include: {
      product: {
        include: { category: true },
      },
    },
  });

  const productAgg = {};

  for (const item of saleItems) {
    if (categoryId && item.product?.categoryId !== Number(categoryId)) continue;

    const pid = item.productId;
    if (!productAgg[pid]) {
      productAgg[pid] = {
        productId: pid,
        name: item.productName || item.product?.name || `Product #${pid}`,
        tamilName: item.product?.tamilName || '',
        category: item.product?.category?.name || 'General',
        barcode: item.product?.barcode || 'N/A',
        measurementType: item.measurementType || item.product?.measurementType || 'PCS',
        unit: item.unit || item.product?.unit || 'pcs',
        totalQuantitySold: 0,
        totalRevenue: 0,
        totalCost: 0,
        currentStock: parseFloat(item.product?.currentStock || 0),
        minStock: parseFloat(item.product?.minStock || 5),
      };
    }

    const qty = parseFloat(item.quantity) || 0;
    const rev = parseFloat(item.lineTotal) || 0;
    const unitCost = parseFloat(item.product?.purchaseCost) || 0;

    productAgg[pid].totalQuantitySold += qty;
    productAgg[pid].totalRevenue += rev;
    productAgg[pid].totalCost += (qty * unitCost);
  }

  let list = Object.values(productAgg);
  list.sort((a, b) => b.totalRevenue - a.totalRevenue);

  // Format and apply permissions (hide purchase cost & profit margin for CASHIER)
  const results = list.slice(0, limit).map((p) => {
    const grossProfit = Number((p.totalRevenue - p.totalCost).toFixed(2));
    const profitMargin = p.totalRevenue > 0 ? Number(((grossProfit / p.totalRevenue) * 100).toFixed(1)) : 0;

    const baseItem = {
      productId: p.productId,
      name: p.name,
      tamilName: p.tamilName,
      category: p.category,
      barcode: p.barcode,
      unit: p.unit,
      quantitySold: Number(p.totalQuantitySold.toFixed(3)),
      revenue: Number(p.totalRevenue.toFixed(2)),
      currentStock: p.currentStock,
    };

    if (userRole === 'ADMIN' || userRole === 'MANAGER') {
      baseItem.grossProfit = grossProfit;
      baseItem.profitMargin = profitMargin;
    }

    return baseItem;
  });

  return {
    period: label,
    limit,
    totalProductsCount: list.length,
    products: results,
  };
}

/**
 * 3. LOW-STOCK, OUT-OF-STOCK & REORDER INTELLIGENCE
 */
export async function getInventoryIntelligence({ userRole }) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: true,
      purchaseItems: {
        include: { purchase: { include: { supplier: true } } },
        orderBy: { id: 'desc' },
        take: 1,
      },
    },
    orderBy: { currentStock: 'asc' },
  });

  const outOfStock = [];
  const lowStock = [];
  const healthyStock = [];

  products.forEach((p) => {
    const stock = parseFloat(p.currentStock) || 0;
    const min = parseFloat(p.minStock) || 5;
    const purchaseCost = parseFloat(p.purchaseCost) || 0;
    const sellingPrice = parseFloat(p.sellingPrice) || 0;
    const lastSupplier = p.purchaseItems[0]?.purchase?.supplier?.name || 'Unassigned';

    const item = {
      id: p.id,
      name: p.name,
      tamilName: p.tamilName || '',
      category: p.category?.name || 'General',
      barcode: p.barcode || 'N/A',
      currentStock: stock,
      minStock: min,
      unit: p.unit || 'pcs',
      measurementType: p.measurementType || 'PCS',
      sellingPrice,
      supplier: lastSupplier,
      recommendedReorderQty: Math.max(Math.ceil((min * 2) - stock), Math.ceil(min)),
    };

    if (userRole === 'ADMIN' || userRole === 'MANAGER') {
      item.purchaseCost = purchaseCost;
      item.stockValuation = Number((stock * purchaseCost).toFixed(2));
    }

    if (stock <= 0) {
      outOfStock.push(item);
    } else if (stock <= min) {
      lowStock.push(item);
    } else {
      healthyStock.push(item);
    }
  });

  return {
    totalActiveProducts: products.length,
    outOfStockCount: outOfStock.length,
    lowStockCount: lowStock.length,
    healthyStockCount: healthyStock.length,
    outOfStockProducts: outOfStock,
    lowStockProducts: lowStock,
    reorderSuggestions: [...outOfStock, ...lowStock].slice(0, 15),
  };
}

/**
 * 4. PROFIT, EXPENSES & FINANCIAL ANALYSIS
 */
export async function getFinancialIntelligence({ period = 'this_month', startDate, endDate, userRole }) {
  if (userRole === 'CASHIER') {
    return {
      error: 'ACCESS_RESTRICTED',
      message: 'Financial margins and wholesale cost analysis require Manager or Admin permissions.',
    };
  }

  const { currentStart, currentEnd, label } = resolveDateRange(period, startDate, endDate);

  const [sales, saleItems, purchases] = await Promise.all([
    prisma.sale.findMany({
      where: { createdAt: { gte: currentStart, lte: currentEnd } },
    }),
    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: currentStart, lte: currentEnd } } },
      include: { product: true },
    }),
    prisma.purchase.findMany({
      where: {
        purchaseDate: { gte: currentStart, lte: currentEnd },
        status: 'RECEIVED',
      },
    }),
  ]);

  let totalGrossRevenue = 0;
  let totalDiscounts = 0;
  let totalNetSales = 0;
  let totalCostOfGoodsSold = 0;

  sales.forEach((s) => {
    totalGrossRevenue += parseFloat(s.subtotal) || parseFloat(s.grandTotal) || 0;
    totalDiscounts += parseFloat(s.discountTotal) || 0;
    totalNetSales += parseFloat(s.grandTotal) || 0;
  });

  saleItems.forEach((item) => {
    const qty = parseFloat(item.quantity) || 0;
    const unitCost = parseFloat(item.product?.purchaseCost) || 0;
    totalCostOfGoodsSold += (qty * unitCost);
  });

  const grossProfit = totalNetSales - totalCostOfGoodsSold;
  const grossProfitMargin = totalNetSales > 0 ? Number(((grossProfit / totalNetSales) * 100).toFixed(2)) : 0;

  const totalPurchasesAmount = purchases.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0);

  return {
    period: label,
    grossRevenue: Number(totalGrossRevenue.toFixed(2)),
    discounts: Number(totalDiscounts.toFixed(2)),
    netSales: Number(totalNetSales.toFixed(2)),
    costOfGoodsSold: Number(totalCostOfGoodsSold.toFixed(2)),
    grossProfit: Number(grossProfit.toFixed(2)),
    grossProfitMarginPercent: grossProfitMargin,
    purchasesInPeriod: Number(totalPurchasesAmount.toFixed(2)),
    operatingExpensesNote: 'Operating expenses (rent, electricity, staff wages) are not currently tracked in the database module. Gross profit is verified based on actual Net Sales minus Cost of Goods Sold.',
    definitions: {
      netSales: 'Total sales revenue collected from customers minus item-level and bill discounts.',
      cogs: 'Verified purchase cost of all inventory units sold during this period.',
      grossProfit: 'Net Sales minus Cost of Goods Sold.',
      grossMargin: 'Percentage of revenue retained after paying inventory costs (Gross Profit / Net Sales * 100).',
    },
  };
}

/**
 * 5. BARCODE & PRINTING INTELLIGENCE
 */
export async function getBarcodeIntelligence({ currentSelectionState = null }) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { category: true },
  });

  let withBarcode = 0;
  let missingBarcode = 0;
  const missingList = [];
  const barcodeMap = {};

  products.forEach((p) => {
    const code = p.barcode ? p.barcode.trim() : '';
    if (!code) {
      missingBarcode++;
      missingList.push({
        id: p.id,
        name: p.name,
        tamilName: p.tamilName || '',
        category: p.category?.name || 'General',
        sellingPrice: parseFloat(p.sellingPrice) || 0,
      });
    } else {
      withBarcode++;
      if (!barcodeMap[code]) barcodeMap[code] = [];
      barcodeMap[code].push({ id: p.id, name: p.name, barcode: code });
    }
  });

  // Identify duplicate barcodes
  const duplicateBarcodes = Object.entries(barcodeMap)
    .filter(([_, list]) => list.length > 1)
    .map(([code, items]) => ({
      barcode: code,
      count: items.length,
      products: items.map((i) => `${i.name} (ID: ${i.id})`),
    }));

  const result = {
    totalProducts: products.length,
    validBarcodesCount: withBarcode,
    missingBarcodesCount: missingBarcode,
    missingProducts: missingList.slice(0, 15),
    duplicateBarcodesCount: duplicateBarcodes.length,
    duplicateBarcodes,
    supportedLabelSizes: ['50x25 mm', '50x30 mm', '38x25 mm', '85x40 mm'],
    codeStandard: 'Code 128 (High-density alphanumeric with checksum)',
  };

  // If UI selection state was passed
  if (currentSelectionState) {
    result.currentSelection = {
      selectedCount: currentSelectionState.selectedProductIds?.length || 0,
      labelSizeSelected: currentSelectionState.printLabelSize || '50x25 mm',
      copiesPerProduct: currentSelectionState.globalCopies || 2,
      totalLabelsToPrint: (currentSelectionState.selectedProductIds?.length || 0) * (currentSelectionState.globalCopies || 2),
    };
  }

  return result;
}

/**
 * 6. SUPPLIERS & PURCHASES INTELLIGENCE
 */
export async function getSupplierIntelligence({ supplierId, userRole }) {
  if (userRole === 'CASHIER') {
    return {
      error: 'ACCESS_RESTRICTED',
      message: 'Supplier contacts and purchase invoices require Manager or Admin permissions.',
    };
  }

  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    include: {
      purchases: {
        orderBy: { purchaseDate: 'desc' },
      },
    },
  });

  const supplierList = suppliers.map((s) => {
    const totalPurchases = s.purchases.length;
    const totalAmount = s.purchases.reduce((sum, p) => sum + (parseFloat(p.totalAmount) || 0), 0);
    const paidAmount = s.purchases.reduce((sum, p) => sum + (parseFloat(p.paidAmount) || 0), 0);
    const pendingDues = s.purchases.reduce((sum, p) => sum + (parseFloat(p.balanceAmount) || 0), 0);

    return {
      id: s.id,
      name: s.name,
      contactPerson: s.contactPerson || 'N/A',
      phone: s.phone,
      email: s.email || 'N/A',
      totalPurchases,
      totalSpend: Number(totalAmount.toFixed(2)),
      paidAmount: Number(paidAmount.toFixed(2)),
      pendingDues: Number(pendingDues.toFixed(2)),
      recentPurchases: s.purchases.slice(0, 3).map((p) => ({
        invoiceNumber: p.invoiceNumber,
        date: new Date(p.purchaseDate).toLocaleDateString('en-IN'),
        amount: parseFloat(p.totalAmount),
        status: p.status,
      })),
    };
  });

  const totalDuesAcrossStore = supplierList.reduce((sum, s) => sum + s.pendingDues, 0);

  return {
    totalSuppliers: suppliers.length,
    totalOutstandingDues: Number(totalDuesAcrossStore.toFixed(2)),
    suppliers: supplierList,
  };
}

/**
 * 7. CUSTOMERS & LOYALTY INTELLIGENCE
 */
export async function getCustomerIntelligence({ phone, customerId, userRole }) {
  const loyaltySettings = await prisma.loyaltySettings.findFirst();

  if (phone || customerId) {
    const where = phone ? { phone } : { id: Number(customerId) };
    const customer = await prisma.customer.findFirst({
      where,
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!customer) {
      return { found: false, message: 'Customer not found.' };
    }

    const totalSpent = customer.sales.reduce((sum, s) => sum + (parseFloat(s.grandTotal) || 0), 0);
    const maskedPhone = userRole === 'CASHIER' 
      ? customer.phone.replace(/(\d{2})\d{4}(\d{4})/, '$1****$2') 
      : customer.phone;

    return {
      found: true,
      id: customer.id,
      name: customer.name,
      phone: maskedPhone,
      loyaltyBalance: parseFloat(customer.loyaltyBalance) || 0,
      totalVisits: customer.sales.length,
      totalSpent: Number(totalSpent.toFixed(2)),
      recentBills: customer.sales.map((s) => ({
        billNumber: s.billNumber,
        date: new Date(s.createdAt).toLocaleDateString('en-IN'),
        amount: parseFloat(s.grandTotal),
      })),
    };
  }

  // Storewide customers summary
  const [totalCustomers, customersWithBalance, topCustomers] = await Promise.all([
    prisma.customer.count({ where: { isActive: true } }),
    prisma.customer.findMany({
      where: { loyaltyBalance: { gt: 0 } },
      select: { loyaltyBalance: true },
    }),
    prisma.customer.findMany({
      where: { isActive: true },
      include: { sales: { select: { grandTotal: true } } },
      take: 10,
    }),
  ]);

  const totalPointsInCirculation = customersWithBalance.reduce((sum, c) => sum + (parseFloat(c.loyaltyBalance) || 0), 0);

  const topCustomerRanks = topCustomers.map((c) => ({
    name: c.name,
    maskedPhone: c.phone.replace(/(\d{2})\d{4}(\d{4})/, '$1****$2'),
    loyaltyBalance: parseFloat(c.loyaltyBalance) || 0,
    totalPurchases: c.sales.reduce((sum, s) => sum + (parseFloat(s.grandTotal) || 0), 0),
    visitCount: c.sales.length,
  })).sort((a, b) => b.totalPurchases - a.totalPurchases);

  return {
    totalRegisteredCustomers: totalCustomers,
    totalPointsInCirculation: Number(totalPointsInCirculation.toFixed(1)),
    loyaltySettings: {
      isEnabled: loyaltySettings?.isEnabled ?? true,
      earnRule: `${loyaltySettings?.pointsPerAmount || 5} points per ₹${loyaltySettings?.minPurchaseAmount || 100}`,
      redemptionRule: `1 Point = ₹${loyaltySettings?.pointsRedemptionValue || 1.0}`,
      minRedeemPoints: parseFloat(loyaltySettings?.minRedemptionPoints || 10),
    },
    topCustomers: topCustomerRanks.slice(0, 5),
  };
}

/**
 * 8. STAFF & CASHIER ANALYSIS
 */
export async function getStaffCashierIntelligence({ cashierId, userRole }) {
  if (userRole === 'CASHIER') {
    return {
      error: 'ACCESS_RESTRICTED',
      message: 'Staff-wide audit analysis requires Manager or Admin authorization.',
    };
  }

  const staff = await prisma.user.findMany({
    where: { isActive: true },
    include: {
      sales: {
        select: {
          grandTotal: true,
          paymentMethod: true,
          createdAt: true,
        },
      },
      auditLogs: {
        take: 3,
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const staffSummaries = staff.map((s) => {
    const totalSales = s.sales.reduce((sum, sl) => sum + (parseFloat(sl.grandTotal) || 0), 0);
    const billCount = s.sales.length;
    const avgBill = billCount > 0 ? Number((totalSales / billCount).toFixed(2)) : 0;

    const paymentMethods = {};
    s.sales.forEach((sl) => {
      paymentMethods[sl.paymentMethod] = (paymentMethods[sl.paymentMethod] || 0) + (parseFloat(sl.grandTotal) || 0);
    });

    return {
      id: s.id,
      fullName: s.fullName,
      username: s.username,
      role: s.role,
      totalBillsHandled: billCount,
      totalSalesRevenue: Number(totalSales.toFixed(2)),
      averageBillValue: avgBill,
      paymentCollected: Object.entries(paymentMethods).map(([m, amt]) => ({ method: m, amount: Number(amt.toFixed(2)) })),
      recentActions: s.auditLogs.map((a) => `${a.action} on ${a.entity} at ${new Date(a.createdAt).toLocaleTimeString('en-IN')}`),
    };
  });

  return {
    totalStaff: staff.length,
    staff: staffSummaries,
  };
}

/**
 * 9. PERIOD COMPARISON & SALES DECLINE / INCREASE ANALYSIS
 */
export async function comparePeriods({ periodA = 'this_week', periodB = 'last_week', userRole }) {
  const rangeA = resolveDateRange(periodA);
  const rangeB = resolveDateRange(periodB);

  const [salesA, salesB] = await Promise.all([
    prisma.sale.findMany({ where: { createdAt: { gte: rangeA.currentStart, lte: rangeA.currentEnd } } }),
    prisma.sale.findMany({ where: { createdAt: { gte: rangeB.currentStart, lte: rangeB.currentEnd } } }),
  ]);

  const totalA = salesA.reduce((sum, s) => sum + (parseFloat(s.grandTotal) || 0), 0);
  const totalB = salesB.reduce((sum, s) => sum + (parseFloat(s.grandTotal) || 0), 0);

  const diff = totalA - totalB;
  const percentChange = totalB > 0 ? Number(((diff / totalB) * 100).toFixed(1)) : 0;

  return {
    periodA: { label: rangeA.label, totalSales: Number(totalA.toFixed(2)), bills: salesA.length },
    periodB: { label: rangeB.label, totalSales: Number(totalB.toFixed(2)), bills: salesB.length },
    difference: Number(diff.toFixed(2)),
    percentageChange: percentChange,
    trend: diff >= 0 ? 'INCREASE' : 'DECREASE',
  };
}

/**
 * 10. OVERALL STORE SUMMARY
 */
export async function getStoreSummary({ userRole }) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

  const [todaySales, monthSales, activeProducts, lowStock, totalCust] = await Promise.all([
    prisma.sale.aggregate({
      _sum: { grandTotal: true },
      _count: { id: true },
      where: { createdAt: { gte: startOfToday } },
    }),
    prisma.sale.aggregate({
      _sum: { grandTotal: true },
      where: { createdAt: { gte: startOfMonth } },
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { isActive: true, currentStock: { lte: 5 } } }),
    prisma.customer.count({ where: { isActive: true } }),
  ]);

  const summary = {
    todaySales: parseFloat(todaySales._sum.grandTotal || 0),
    todayBills: todaySales._count.id || 0,
    monthSales: parseFloat(monthSales._sum.grandTotal || 0),
    totalActiveProducts: activeProducts,
    lowStockAlerts: lowStock,
    totalCustomers: totalCust,
  };

  return summary;
}
