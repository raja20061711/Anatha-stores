import axios from 'axios';
import prisma from './server/db.js';

const API_BASE = 'http://localhost:5000/api';

async function runWeightBillingTests() {
  console.log('================================================================');
  console.log('⚖️  ANANTHA STORES — AUTOMATIC WEIGHT-BASED GROCERY BILLING TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✔ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name} ->`, err.response?.data?.error || err.message);
      failed++;
    }
  }

  let adminToken = '';
  let cashierToken = '';

  // Auth Setup
  await test('0. Login Admin & Cashier', async () => {
    const adminRes = await axios.post(`${API_BASE}/auth/login`, { username: 'admin', password: 'admin123' });
    adminToken = adminRes.data.token;
    const cashierRes = await axios.post(`${API_BASE}/auth/login`, { username: 'cashier', password: 'cashier123' });
    cashierToken = cashierRes.data.token;
  });

  const adminHeaders = () => ({ headers: { Authorization: `Bearer ${adminToken}` } });
  const cashierHeaders = () => ({ headers: { Authorization: `Bearer ${cashierToken}` } });

  // Helper to find or create product
  async function findOrCreateProduct(data) {
    const res = await axios.get(`${API_BASE}/products?includeInactive=true`, adminHeaders());
    const existing = res.data.find((p) => p.name.toLowerCase() === data.name.toLowerCase());
    if (existing) {
      const updated = await axios.put(`${API_BASE}/products/${existing.id}`, { ...data }, adminHeaders());
      return updated.data;
    }
    const created = await axios.post(`${API_BASE}/products`, data, adminHeaders());
    return created.data;
  }

  // Categories
  const catRes = await axios.get(`${API_BASE}/products/categories`, adminHeaders());
  const groceryCatId = catRes.data[0]?.id || 1;

  // Products Setup
  let rice, cashews, onion, dal, soap, stockRice;

  await test('0.1 Setup Test Grocery Products with Unit Configurations', async () => {
    rice = await findOrCreateProduct({
      name: 'Weight Test Rice',
      tamilName: 'பொன்னி அரிசி',
      brand: 'Anantha Grocery',
      categoryId: groceryCatId,
      measurementType: 'KG',
      baseUnit: 'kg',
      unit: 'kg',
      sellingPrice: 200,
      pricePerKg: 200,
      purchaseCost: 150,
      currentStock: 100,
      minStock: 10,
    });

    cashews = await findOrCreateProduct({
      name: 'Weight Test Cashews',
      tamilName: 'முந்திரி பருப்பு',
      brand: 'Anantha Premium',
      categoryId: groceryCatId,
      measurementType: 'KG',
      baseUnit: 'kg',
      unit: 'kg',
      sellingPrice: 360,
      pricePerKg: 360,
      purchaseCost: 280,
      currentStock: 50,
      minStock: 5,
    });

    onion = await findOrCreateProduct({
      name: 'Weight Test Onion',
      tamilName: 'வெங்காயம்',
      brand: 'Fresh Farm',
      categoryId: groceryCatId,
      measurementType: 'KG',
      baseUnit: 'kg',
      unit: 'kg',
      sellingPrice: 50,
      pricePerKg: 50,
      purchaseCost: 35,
      currentStock: 50,
      minStock: 10,
    });

    dal = await findOrCreateProduct({
      name: 'Weight Test Dal',
      tamilName: 'துவரம் பருப்பு',
      brand: 'Anantha Pulses',
      categoryId: groceryCatId,
      measurementType: 'KG',
      baseUnit: 'kg',
      unit: 'kg',
      sellingPrice: 200,
      pricePerKg: 200,
      purchaseCost: 160,
      currentStock: 50,
      minStock: 5,
    });

    soap = await findOrCreateProduct({
      name: 'Piece Test Soap',
      tamilName: 'ஹமாம் சோப்',
      brand: 'Hamam',
      categoryId: groceryCatId,
      measurementType: 'PCS',
      baseUnit: 'pcs',
      unit: 'pcs',
      sellingPrice: 25,
      pricePerKg: null,
      purchaseCost: 18,
      currentStock: 50,
      minStock: 5,
    });

    stockRice = await findOrCreateProduct({
      name: 'Stock Deduction Test Rice',
      tamilName: 'பச்சரிசி',
      brand: 'Anantha Grocery',
      categoryId: groceryCatId,
      measurementType: 'KG',
      baseUnit: 'kg',
      unit: 'kg',
      sellingPrice: 100,
      pricePerKg: 100,
      purchaseCost: 75,
      currentStock: 10.0,
      minStock: 2,
    });
  });

  // TEST CASE 1: Rice @ ₹200 / KG, 1 kg -> Expected Total: ₹200
  let bill1;
  await test('Test Case 1: Rice @ ₹200/KG, Selected 1 kg -> ₹200.00', async () => {
    const res = await axios.post(
      `${API_BASE}/sales/checkout`,
      {
        items: [
          {
            productId: rice.id,
            selectedQuantity: 1,
            selectedUnit: 'kg',
            quantity: 1,
          },
        ],
        paymentMethod: 'CASH',
        amountReceived: 200,
      },
      cashierHeaders()
    );
    bill1 = res.data.sale;
    if (Number(bill1.grandTotal) !== 200) {
      throw new Error(`Expected grandTotal 200, got ${bill1.grandTotal}`);
    }
    const item = bill1.items[0];
    if (Number(item.lineTotal) !== 200) {
      throw new Error(`Expected line total 200, got ${item.lineTotal}`);
    }
    if (Number(item.quantity) !== 1) {
      throw new Error(`Expected canonical quantity 1 kg, got ${item.quantity}`);
    }
  });

  // TEST CASE 2: Rice @ ₹200 / KG, 500 g -> Expected Total: ₹100
  let bill2;
  await test('Test Case 2: Rice @ ₹200/KG, Selected 500 g -> ₹100.00', async () => {
    const res = await axios.post(
      `${API_BASE}/sales/checkout`,
      {
        items: [
          {
            productId: rice.id,
            selectedQuantity: 500,
            selectedUnit: 'g',
            quantity: 0.5,
          },
        ],
        paymentMethod: 'CASH',
        amountReceived: 100,
      },
      cashierHeaders()
    );
    bill2 = res.data.sale;
    if (Number(bill2.grandTotal) !== 100) {
      throw new Error(`Expected grandTotal 100, got ${bill2.grandTotal}`);
    }
    const item = bill2.items[0];
    if (Number(item.lineTotal) !== 100) {
      throw new Error(`Expected line total 100, got ${item.lineTotal}`);
    }
    if (Number(item.quantity) !== 0.5) {
      throw new Error(`Expected canonical quantity 0.5 kg, got ${item.quantity}`);
    }
  });

  // TEST CASE 3: Rice @ ₹200 / KG, 250 g -> Expected Total: ₹50
  await test('Test Case 3: Rice @ ₹200/KG, Selected 250 g -> ₹50.00', async () => {
    const res = await axios.post(
      `${API_BASE}/sales/checkout`,
      {
        items: [
          {
            productId: rice.id,
            selectedQuantity: 250,
            selectedUnit: 'g',
            quantity: 0.25,
          },
        ],
        paymentMethod: 'CASH',
        amountReceived: 50,
      },
      cashierHeaders()
    );
    const sale = res.data.sale;
    if (Number(sale.grandTotal) !== 50) {
      throw new Error(`Expected grandTotal 50, got ${sale.grandTotal}`);
    }
    const item = sale.items[0];
    if (Number(item.lineTotal) !== 50) {
      throw new Error(`Expected line total 50, got ${item.lineTotal}`);
    }
    if (Number(item.quantity) !== 0.25) {
      throw new Error(`Expected canonical quantity 0.25 kg, got ${item.quantity}`);
    }
  });

  // TEST CASE 4: Rice @ ₹200 / KG, 150 g -> Expected Total: ₹30
  await test('Test Case 4: Rice @ ₹200/KG, Selected 150 g -> ₹30.00', async () => {
    const res = await axios.post(
      `${API_BASE}/sales/checkout`,
      {
        items: [
          {
            productId: rice.id,
            selectedQuantity: 150,
            selectedUnit: 'g',
            quantity: 0.15,
          },
        ],
        paymentMethod: 'CASH',
        amountReceived: 30,
      },
      cashierHeaders()
    );
    const sale = res.data.sale;
    if (Number(sale.grandTotal) !== 30) {
      throw new Error(`Expected grandTotal 30, got ${sale.grandTotal}`);
    }
    const item = sale.items[0];
    if (Number(item.lineTotal) !== 30) {
      throw new Error(`Expected line total 30, got ${item.lineTotal}`);
    }
    if (Number(item.quantity) !== 0.15) {
      throw new Error(`Expected canonical quantity 0.15 kg, got ${item.quantity}`);
    }
  });

  // TEST CASE 5: Cashews @ ₹360 / KG, 150 g -> Expected Total: ₹54
  await test('Test Case 5: Cashews @ ₹360/KG, Selected 150 g -> ₹54.00', async () => {
    const res = await axios.post(
      `${API_BASE}/sales/checkout`,
      {
        items: [
          {
            productId: cashews.id,
            selectedQuantity: 150,
            selectedUnit: 'g',
            quantity: 0.15,
          },
        ],
        paymentMethod: 'CASH',
        amountReceived: 54,
      },
      cashierHeaders()
    );
    const sale = res.data.sale;
    if (Number(sale.grandTotal) !== 54) {
      throw new Error(`Expected grandTotal 54, got ${sale.grandTotal}`);
    }
    const item = sale.items[0];
    if (Number(item.lineTotal) !== 54) {
      throw new Error(`Expected line total 54, got ${item.lineTotal}`);
    }
  });

  // TEST CASE 6: Onion @ ₹50 / KG, 250 g -> Expected Total: ₹12.50
  await test('Test Case 6: Onion @ ₹50/KG, Selected 250 g -> ₹12.50', async () => {
    const res = await axios.post(
      `${API_BASE}/sales/checkout`,
      {
        items: [
          {
            productId: onion.id,
            selectedQuantity: 250,
            selectedUnit: 'g',
            quantity: 0.25,
          },
        ],
        paymentMethod: 'CASH',
        amountReceived: 20,
      },
      cashierHeaders()
    );
    const sale = res.data.sale;
    if (Number(sale.grandTotal) !== 12.5) {
      throw new Error(`Expected grandTotal 12.50, got ${sale.grandTotal}`);
    }
    const item = sale.items[0];
    if (Number(item.lineTotal) !== 12.5) {
      throw new Error(`Expected line total 12.50, got ${item.lineTotal}`);
    }
  });

  // TEST CASE 7: Dal @ ₹200 / KG, 1.25 kg -> Expected Total: ₹250
  await test('Test Case 7: Dal @ ₹200/KG, Selected 1.25 kg -> ₹250.00', async () => {
    const res = await axios.post(
      `${API_BASE}/sales/checkout`,
      {
        items: [
          {
            productId: dal.id,
            selectedQuantity: 1.25,
            selectedUnit: 'kg',
            quantity: 1.25,
          },
        ],
        paymentMethod: 'CASH',
        amountReceived: 250,
      },
      cashierHeaders()
    );
    const sale = res.data.sale;
    if (Number(sale.grandTotal) !== 250) {
      throw new Error(`Expected grandTotal 250, got ${sale.grandTotal}`);
    }
    const item = sale.items[0];
    if (Number(item.lineTotal) !== 250) {
      throw new Error(`Expected line total 250, got ${item.lineTotal}`);
    }
    if (Number(item.quantity) !== 1.25) {
      throw new Error(`Expected canonical quantity 1.25 kg, got ${item.quantity}`);
    }
  });

  // TEST CASE 8: Soap (Piece-based) @ ₹25 / piece, 2 pcs -> Expected Total: ₹50
  await test('Test Case 8: Soap @ ₹25/pc, Selected 2 pcs -> ₹50.00 (Piece logic unaffected)', async () => {
    const res = await axios.post(
      `${API_BASE}/sales/checkout`,
      {
        items: [
          {
            productId: soap.id,
            selectedQuantity: 2,
            selectedUnit: 'pcs',
            quantity: 2,
          },
        ],
        paymentMethod: 'CASH',
        amountReceived: 50,
      },
      cashierHeaders()
    );
    const sale = res.data.sale;
    if (Number(sale.grandTotal) !== 50) {
      throw new Error(`Expected grandTotal 50, got ${sale.grandTotal}`);
    }
    const item = sale.items[0];
    if (Number(item.lineTotal) !== 50) {
      throw new Error(`Expected line total 50, got ${item.lineTotal}`);
    }
    if (Number(item.quantity) !== 2) {
      throw new Error(`Expected quantity 2, got ${item.quantity}`);
    }
  });

  // TEST CASE 9: Initial Stock 10 kg, Sale 250 g -> Expected Stock Remaining: 9.75 kg
  let stockBill;
  await test('Test Case 9: Initial Stock 10 kg - 250 g sale -> Remaining Stock = 9.75 kg', async () => {
    // Ensure stock is set to exactly 10 kg first
    const curRes = await axios.get(`${API_BASE}/products?includeInactive=true`, adminHeaders());
    const curStockRice = curRes.data.find((p) => p.id === stockRice.id);
    const diff = 10.0 - Number(curStockRice.currentStock);
    if (Math.abs(diff) > 0.0001) {
      await axios.post(
        `${API_BASE}/inventory/adjust`,
        {
          productId: stockRice.id,
          type: 'ADJUSTMENT',
          quantityChange: diff,
          reason: 'Reset test stock to 10kg',
        },
        adminHeaders()
      );
    }

    const res = await axios.post(
      `${API_BASE}/sales/checkout`,
      {
        items: [
          {
            productId: stockRice.id,
            selectedQuantity: 250,
            selectedUnit: 'g',
            quantity: 0.25,
          },
        ],
        paymentMethod: 'CASH',
        amountReceived: 25,
      },
      cashierHeaders()
    );
    stockBill = res.data.sale;

    // Fetch updated stock
    const prodRes = await axios.get(`${API_BASE}/products?includeInactive=true`, adminHeaders());
    const updated = prodRes.data.find((p) => p.id === stockRice.id);
    const remainingStock = Number(updated.currentStock);

    if (Math.abs(remainingStock - 9.75) > 0.001) {
      throw new Error(`Expected stock remaining 9.75 kg, but got ${remainingStock} kg`);
    }
  });

  // TEST CASE 10: Reprint receipt does NOT deduct stock a second time
  await test('Test Case 10: Reprint completed bill does NOT deduct stock', async () => {
    // Fetch bill details 2 times (simulating viewing/reprinting receipt)
    const reprint1 = await axios.get(`${API_BASE}/sales/${stockBill.id}`, cashierHeaders());
    const reprint2 = await axios.get(`${API_BASE}/sales/${stockBill.id}`, adminHeaders());

    if (reprint1.data.billNumber !== stockBill.billNumber || reprint2.data.billNumber !== stockBill.billNumber) {
      throw new Error('Reprint data mismatch');
    }

    // Verify stock is STILL 9.75 kg
    const prodRes = await axios.get(`${API_BASE}/products?includeInactive=true`, adminHeaders());
    const checked = prodRes.data.find((p) => p.id === stockRice.id);
    const stockAfterReprint = Number(checked.currentStock);

    if (Math.abs(stockAfterReprint - 9.75) > 0.001) {
      throw new Error(`Stock was altered during reprint! Expected 9.75 kg, found ${stockAfterReprint} kg`);
    }
  });

  // TEST CASE 11: Admin updates Rice price to ₹220 / KG:
  // - New bill uses ₹220 / KG (500 g -> ₹110)
  // - Old receipt preserves ₹200 / KG (500 g -> ₹100)
  await test('Test Case 11: Admin price update (₹200 -> ₹220/KG) affects new bills and preserves historical bills', async () => {
    // Admin updates price
    await axios.put(
      `${API_BASE}/products/${rice.id}/price`,
      {
        newSellingPrice: 220,
        reason: 'Market rate adjustment',
      },
      adminHeaders()
    );

    // New bill for 500 g of Rice at new rate
    const newBillRes = await axios.post(
      `${API_BASE}/sales/checkout`,
      {
        items: [
          {
            productId: rice.id,
            selectedQuantity: 500,
            selectedUnit: 'g',
            quantity: 0.5,
          },
        ],
        paymentMethod: 'CASH',
        amountReceived: 110,
      },
      cashierHeaders()
    );

    const newBill = newBillRes.data.sale;
    if (Number(newBill.grandTotal) !== 110) {
      throw new Error(`Expected new bill grandTotal 110.00 (500g @ ₹220/kg), got ${newBill.grandTotal}`);
    }

    // Check historical bill (bill2 from Test Case 2)
    const oldBillRes = await axios.get(`${API_BASE}/sales/${bill2.id}`, cashierHeaders());
    const oldBill = oldBillRes.data;

    if (Number(oldBill.grandTotal) !== 100) {
      throw new Error(`Historical bill was corrupted! Expected 100.00, got ${oldBill.grandTotal}`);
    }
    if (Number(oldBill.items[0].lineTotal) !== 100) {
      throw new Error(`Historical item total was corrupted! Expected 100.00, got ${oldBill.items[0].lineTotal}`);
    }
    if (Number(oldBill.items[0].lineTotal) !== 100) {
      throw new Error(`Historical item total was corrupted! Expected 100.00, got ${oldBill.items[0].lineTotal}`);
    }

    // Reset rice price back to 200 for idempotency
    await axios.put(
      `${API_BASE}/products/${rice.id}/price`,
      {
        newSellingPrice: 200,
        reason: 'Reset to standard test rate',
      },
      adminHeaders()
    );
  });

  // TEST CASE 12: Invalid input validation
  await test('Test Case 12.1: Zero quantity rejected with 400', async () => {
    try {
      await axios.post(
        `${API_BASE}/sales/checkout`,
        {
          items: [{ productId: rice.id, selectedQuantity: 0, selectedUnit: 'kg' }],
          paymentMethod: 'CASH',
        },
        cashierHeaders()
      );
      throw new Error('Should have rejected zero quantity');
    } catch (err) {
      if (err.response?.status !== 400) throw err;
    }
  });

  await test('Test Case 12.2: Negative weight quantity rejected with 400', async () => {
    try {
      await axios.post(
        `${API_BASE}/sales/checkout`,
        {
          items: [{ productId: rice.id, selectedQuantity: -250, selectedUnit: 'g' }],
          paymentMethod: 'CASH',
        },
        cashierHeaders()
      );
      throw new Error('Should have rejected negative quantity');
    } catch (err) {
      if (err.response?.status !== 400) throw err;
    }
  });

  await test('Test Case 12.3: Non-existent product ID rejected with 400/404', async () => {
    try {
      await axios.post(
        `${API_BASE}/sales/checkout`,
        {
          items: [{ productId: 9999999, selectedQuantity: 500, selectedUnit: 'g' }],
          paymentMethod: 'CASH',
        },
        cashierHeaders()
      );
    } catch (err) {
      if (![400, 404].includes(err.response?.status)) throw err;
    }
  });

  // Clean up test fixtures from database
  await test('Teardown test fixtures', async () => {
    const testIds = [rice?.id, cashews?.id, onion?.id, dal?.id, soap?.id, stockRice?.id].filter(Boolean);
    if (testIds.length > 0) {
      const sales = await prisma.sale.findMany({
        where: { items: { some: { productId: { in: testIds } } } },
        select: { id: true, billNumber: true }
      });
      const saleIds = sales.map(s => s.id);
      const bills = sales.map(s => s.billNumber);

      await prisma.stockMovement.deleteMany({
        where: {
          OR: [
            { productId: { in: testIds } },
            { referenceId: { in: bills } }
          ]
        }
      });
      await prisma.payment.deleteMany({ where: { saleId: { in: saleIds } } });
      await prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
      await prisma.sale.deleteMany({ where: { id: { in: saleIds } } });
      await prisma.priceHistory.deleteMany({ where: { productId: { in: testIds } } });
      await prisma.product.deleteMany({ where: { id: { in: testIds } } });
    }
    await prisma.$disconnect();
  });

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runWeightBillingTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
