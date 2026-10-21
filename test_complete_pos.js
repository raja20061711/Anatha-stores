import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 ANATHA STORES POS — COMPREHENSIVE AUTOMATED TESTS');
  console.log('====================================================\n');

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
  let managerToken = '';
  let cashierToken = '';

  // 1. Role Logins
  await test('1. Admin login succeeds and returns ADMIN role', async () => {
    const res = await axios.post(`${API_BASE}/auth/login`, { username: 'admin', password: 'admin123' });
    if (res.data.user.role !== 'ADMIN') throw new Error('Role mismatch');
    adminToken = res.data.token;
  });

  await test('2. Manager login succeeds and returns MANAGER role', async () => {
    const res = await axios.post(`${API_BASE}/auth/login`, { username: 'manager', password: 'manager123' });
    if (res.data.user.role !== 'MANAGER') throw new Error('Role mismatch');
    managerToken = res.data.token;
  });

  await test('3. Cashier login succeeds and returns CASHIER role', async () => {
    const res = await axios.post(`${API_BASE}/auth/login`, { username: 'cashier', password: 'cashier123' });
    if (res.data.user.role !== 'CASHIER') throw new Error('Role mismatch');
    cashierToken = res.data.token;
  });

  await test('4. Invalid credentials rejected with 401', async () => {
    try {
      await axios.post(`${API_BASE}/auth/login`, { username: 'admin', password: 'wrongpassword' });
      throw new Error('Should have failed');
    } catch (err) {
      if (err.response?.status !== 401) throw err;
    }
  });

  // 2. Product Management
  let createdProductId = null;
  await test('5. Admin creates new product with Tamil title', async () => {
    const res = await axios.post(
      `${API_BASE}/products`,
      {
        name: 'Automated Test Ghee 500ml',
        tamilName: 'நெய் 500மி.லி',
        brand: 'Anatha',
        unit: 'jar',
        purchaseCost: 280,
        sellingPrice: 320,
        currentStock: 25,
        minStock: 5,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    createdProductId = res.data.id;
    if (!createdProductId) throw new Error('Product not created');
  });

  await test('6. Cashier CANNOT create new products (403 Forbidden)', async () => {
    try {
      await axios.post(
        `${API_BASE}/products`,
        { name: 'Unauthorized Biscuit', sellingPrice: 20 },
        { headers: { Authorization: `Bearer ${cashierToken}` } }
      );
      throw new Error('Cashier should have been forbidden');
    } catch (err) {
      if (err.response?.status !== 403) throw err;
    }
  });

  await test('7. Admin changes default selling price & records Price History', async () => {
    const res = await axios.put(
      `${API_BASE}/products/${createdProductId}/price`,
      { newSellingPrice: 330, reason: 'Test Price Adjustment' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    if (Number(res.data.product.sellingPrice) !== 330) throw new Error('Price not updated');
  });

  await test('8. Manager CANNOT change default selling price (403 Forbidden)', async () => {
    try {
      await axios.put(
        `${API_BASE}/products/${createdProductId}/price`,
        { newSellingPrice: 350, reason: 'Unauthorized' },
        { headers: { Authorization: `Bearer ${managerToken}` } }
      );
      throw new Error('Manager should have been forbidden');
    } catch (err) {
      if (err.response?.status !== 403) throw err;
    }
  });

  // 3. Billing & Rate Override Workflow
  let completedBill = null;
  await test('9. Cashier checkout with manual rate override preserves default price & deducts stock', async () => {
    // Check initial stock
    const pBefore = (await axios.get(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${cashierToken}` } })).data
      .find((p) => p.id === createdProductId);
    const initialStock = Number(pBefore.currentStock);

    // Default price is 330, Cashier bills at 300 with override reason
    const checkoutRes = await axios.post(
      `${API_BASE}/sales/checkout`,
      {
        items: [
          {
            productId: createdProductId,
            quantity: 2,
            billedRate: 300,
            overrideReason: 'VIP Customer Offer',
          },
        ],
        paymentMethod: 'CASH',
        amountReceived: 1000,
      },
      { headers: { Authorization: `Bearer ${cashierToken}` } }
    );

    completedBill = checkoutRes.data.sale;
    if (Number(completedBill.grandTotal) !== 600) throw new Error(`Total mismatch: ${completedBill.grandTotal}`);
    if (Number(completedBill.changeAmount) !== 400) throw new Error(`Change mismatch: ${completedBill.changeAmount}`);
    if (!completedBill.items[0].isOverridden) throw new Error('isOverridden not marked');
    if (Number(completedBill.items[0].billedRate) !== 300) throw new Error('Billed rate mismatch');

    // Verify product default price remains unchanged
    const pAfter = (await axios.get(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${cashierToken}` } })).data
      .find((p) => p.id === createdProductId);

    if (Number(pAfter.sellingPrice) !== 330) throw new Error('Default product price was altered!');
    if (Number(pAfter.currentStock) !== initialStock - 2) throw new Error('Stock was not reduced by 2!');
  });

  // 4. Reprint Safety
  await test('10. Reprinting previous bill preserves bill data without deducting stock again', async () => {
    const pBefore = (await axios.get(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${cashierToken}` } })).data
      .find((p) => p.id === createdProductId);
    const stockBeforeReprint = Number(pBefore.currentStock);

    const billDetails = (await axios.get(`${API_BASE}/sales/${completedBill.id}`, { headers: { Authorization: `Bearer ${cashierToken}` } })).data;
    if (billDetails.billNumber !== completedBill.billNumber) throw new Error('Bill not found');

    const pAfter = (await axios.get(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${cashierToken}` } })).data
      .find((p) => p.id === createdProductId);
    if (Number(pAfter.currentStock) !== stockBeforeReprint) throw new Error('Stock deducted on reprint!');
  });

  // 5. Purchases & Goods Received Stock Safety
  let purchaseId = null;
  await test('11. Draft purchase order does NOT increase stock', async () => {
    const suppliers = (await axios.get(`${API_BASE}/suppliers`, { headers: { Authorization: `Bearer ${adminToken}` } })).data;
    let suppId = suppliers[0]?.id;
    if (!suppId) {
      const s = await axios.post(`${API_BASE}/suppliers`, { name: 'Auto Test Supplier', phone: '9998887776' }, { headers: { Authorization: `Bearer ${adminToken}` } });
      suppId = s.data.id;
    }

    const pBefore = (await axios.get(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${adminToken}` } })).data
      .find((p) => p.id === createdProductId);
    const stockBefore = Number(pBefore.currentStock);

    const purchRes = await axios.post(
      `${API_BASE}/purchases`,
      {
        supplierId: suppId,
        invoiceNumber: `INV-TEST-${Date.now().toString().slice(-5)}`,
        status: 'DRAFT',
        items: [{ productId: createdProductId, quantity: 50, purchaseCost: 280 }],
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    purchaseId = purchRes.data.id;

    const pAfter = (await axios.get(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${adminToken}` } })).data
      .find((p) => p.id === createdProductId);

    if (Number(pAfter.currentStock) !== stockBefore) throw new Error('Draft purchase increased stock!');
  });

  await test('12. Confirming received goods increases stock exactly once', async () => {
    const pBefore = (await axios.get(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${adminToken}` } })).data
      .find((p) => p.id === createdProductId);
    const stockBefore = Number(pBefore.currentStock);

    await axios.put(`${API_BASE}/purchases/${purchaseId}/receive`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });

    const pAfter = (await axios.get(`${API_BASE}/products`, { headers: { Authorization: `Bearer ${adminToken}` } })).data
      .find((p) => p.id === createdProductId);

    if (Number(pAfter.currentStock) !== stockBefore + 50) throw new Error('Stock did not increase by 50!');

    // Test duplicate confirm rejection
    try {
      await axios.put(`${API_BASE}/purchases/${purchaseId}/receive`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
      throw new Error('Duplicate receipt should have been rejected');
    } catch (err) {
      if (err.response?.status !== 400) throw err;
    }
  });

  // 6. Reports Live Database Aggregation
  await test('13. Dashboard report returns live sales and bill counts', async () => {
    const res = await axios.get(`${API_BASE}/reports/dashboard`, { headers: { Authorization: `Bearer ${adminToken}` } });
    if (res.data.todayBills < 1) throw new Error('Today bills count is zero');
    if (res.data.todaySales <= 0) throw new Error('Today sales is zero');
  });

  // 7. Database Backup
  await test('14. Admin creates database snapshot backup to disk', async () => {
    const res = await axios.post(`${API_BASE}/settings/backup`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
    if (!res.data.fileName || !res.data.sizeBytes) throw new Error('Backup failed');
  });

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');
}

runTests();
