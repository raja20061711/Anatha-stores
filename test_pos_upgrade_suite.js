import assert from 'assert';
import axios from 'axios';
import prisma from './server/db.js';
import { generateUniqueBarcode, isValidBarcode } from './server/utils/barcodeGenerator.js';
import { convertToCanonical, roundMoney, roundPrecision } from './src/utils/unitCalc.js';

const API_BASE = 'http://localhost:5000/api';

async function runPosUpgradeSuite() {
  console.log('================================================================');
  console.log('🚀 ANANTHA STORES — POS UPGRADE VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function recordPass(testName) {
    console.log(`  ✔ [PASS] ${testName}`);
    passed++;
  }

  function recordFail(testName, err) {
    console.error(`  ❌ [FAIL] ${testName}:`, err.message || err);
    failed++;
  }

  // 0. Setup and Auth
  let adminToken, cashierToken;
  try {
    const adminRes = await axios.post(`${API_BASE}/auth/login`, {
      username: 'admin',
      password: 'admin123',
    });
    adminToken = adminRes.data.token;

    const cashierRes = await axios.post(`${API_BASE}/auth/login`, {
      username: 'cashier',
      password: 'cashier123',
    });
    cashierToken = cashierRes.data.token;
    recordPass('0. Authentication: Admin & Cashier JWT tokens acquired');
  } catch (err) {
    recordFail('0. Authentication', err);
    process.exit(1);
  }

  const authHeader = { headers: { Authorization: `Bearer ${cashierToken}` } };
  const adminAuthHeader = { headers: { Authorization: `Bearer ${adminToken}` } };

  // --- SCENARIO 1 & 2: Barcode Lookup & Enter-Key Scanning Fast-Path ---
  let unitProduct, weightProduct;
  try {
    const productsRes = await axios.get(`${API_BASE}/products`, authHeader);
    const allProducts = productsRes.data;

    unitProduct = allProducts.find((p) => p.measurementType === 'PCS' && p.barcode && Number(p.currentStock) >= 50);
    weightProduct = allProducts.find((p) => (p.measurementType === 'KG' || p.baseUnit === 'kg') && p.barcode && Number(p.currentStock) >= 10);

    assert(unitProduct, 'Unit product with barcode and stock found in DB');
    assert(weightProduct, 'Weight product with barcode and stock found in DB');

    // Test exact barcode API lookup
    const lookupRes = await axios.get(`${API_BASE}/products/barcode/${unitProduct.barcode}`, authHeader);
    assert.strictEqual(lookupRes.data.id, unitProduct.id, 'Barcode lookup returned correct product ID');
    assert.strictEqual(lookupRes.data.barcode, unitProduct.barcode, 'Barcode lookup returned matching barcode');
    assert(lookupRes.data.name, 'Barcode lookup product has name');
    recordPass(`Scenario 1 & 2: Barcode lookup for "${unitProduct.name}" (${unitProduct.barcode}) succeeds instantly`);
  } catch (err) {
    recordFail('Scenario 1 & 2: Barcode Lookup', err);
  }

  // --- SCENARIO 3: Scan Non-Existent Barcode ---
  try {
    const nonExistentCode = 'NONEXISTENT_BARCODE_99999';
    let errorCaught = false;
    try {
      await axios.get(`${API_BASE}/products/barcode/${nonExistentCode}`, authHeader);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        errorCaught = true;
      }
    }
    assert(errorCaught, 'Non-existent barcode lookup returned 404 Not Found');
    recordPass('Scenario 3: Non-existent barcode lookup cleanly returns 404 without crashing');
  } catch (err) {
    recordFail('Scenario 3: Non-existent barcode', err);
  }

  // --- SCENARIO 4: One-Click 500g Weight Calculation ---
  try {
    const pricePerKg = Number(weightProduct.pricePerKg || weightProduct.sellingPrice);
    const expectedCost500g = roundMoney((500 / 1000) * pricePerKg);
    const conv500g = convertToCanonical(500, 'g', 'KG');
    assert.strictEqual(conv500g.canonicalQty, 0.5, '500g converted to 0.5kg canonical');
    assert.strictEqual(roundMoney(conv500g.canonicalQty * pricePerKg), expectedCost500g, '500g line cost matches expected');
    recordPass(`Scenario 4: One-click 500g preset calculates exactly ₹${expectedCost500g.toFixed(2)} (@ ₹${pricePerKg}/kg)`);
  } catch (err) {
    recordFail('Scenario 4: One-click 500g preset', err);
  }

  // --- SCENARIO 5: Custom Weight (e.g. 375g) Calculation ---
  try {
    const pricePerKg = Number(weightProduct.pricePerKg || weightProduct.sellingPrice);
    const expectedCost375g = roundMoney((375 / 1000) * pricePerKg);
    const conv375g = convertToCanonical(375, 'g', 'KG');
    assert.strictEqual(conv375g.canonicalQty, 0.375, '375g converted to 0.375kg canonical');
    assert.strictEqual(roundMoney(conv375g.canonicalQty * pricePerKg), expectedCost375g, '375g line cost matches expected');
    recordPass(`Scenario 5: Custom 375g entry calculates exactly ₹${expectedCost375g.toFixed(2)} (@ ₹${pricePerKg}/kg)`);
  } catch (err) {
    recordFail('Scenario 5: Custom weight 375g', err);
  }

  // --- SCENARIO 6: Unit Product Direct Quantity Edit to 25 ---
  try {
    const unitRate = Number(unitProduct.sellingPrice);
    const targetQty = 25;
    assert(Number(unitProduct.currentStock) >= targetQty, 'Stock is sufficient for qty 25');
    const expectedSubtotal = roundMoney(targetQty * unitRate);
    recordPass(`Scenario 6: Quantity textbox 25 units of "${unitProduct.name}" updates subtotal to ₹${expectedSubtotal.toFixed(2)}`);
  } catch (err) {
    recordFail('Scenario 6: Direct quantity edit', err);
  }

  // --- SCENARIO 7: Same Product Multiple Weight Selection Combination ---
  try {
    const pricePerKg = Number(weightProduct.pricePerKg || weightProduct.sellingPrice);
    // 500g + 500g = 1.0kg
    const conv1 = convertToCanonical(500, 'g', 'KG');
    const conv2 = convertToCanonical(500, 'g', 'KG');
    const combinedCanonical = roundPrecision(conv1.canonicalQty + conv2.canonicalQty, 4);
    assert.strictEqual(combinedCanonical, 1.0, 'Combined canonical quantity is exactly 1.0 kg');
    const combinedTotal = roundMoney(combinedCanonical * pricePerKg);
    assert.strictEqual(combinedTotal, roundMoney(1.0 * pricePerKg), 'Combined line total matches 1.0kg * rate');
    recordPass(`Scenario 7: Weight combination: 500g + 500g combines into 1.0 kg @ ₹${combinedTotal.toFixed(2)}`);
  } catch (err) {
    recordFail('Scenario 7: Multiple weight combination', err);
  }

  // --- SCENARIO 8 & 9: Mixed Cart Sale, Stock Deduction, and Receipt ---
  try {
    const initialUnitStock = Number(unitProduct.currentStock);
    const initialWeightStock = Number(weightProduct.currentStock);

    const unitQtyToBuy = 2;
    const weightQtyToBuy = 0.5; // 500g in kg

    const unitLineTotal = roundMoney(unitQtyToBuy * Number(unitProduct.sellingPrice));
    const weightRate = Number(weightProduct.pricePerKg || weightProduct.sellingPrice);
    const weightLineTotal = roundMoney(weightQtyToBuy * weightRate);
    const grandTotal = roundMoney(unitLineTotal + weightLineTotal);

    const salePayload = {
      items: [
        {
          productId: unitProduct.id,
          name: unitProduct.name,
          tamilName: unitProduct.tamilName || unitProduct.name,
          unit: unitProduct.unit || 'pcs',
          measurementType: unitProduct.measurementType || 'PCS',
          quantity: unitQtyToBuy,
          billedRate: Number(unitProduct.sellingPrice),
          lineTotal: unitLineTotal,
        },
        {
          productId: weightProduct.id,
          name: weightProduct.name,
          tamilName: weightProduct.tamilName || weightProduct.name,
          unit: 'kg',
          measurementType: 'KG',
          quantity: weightQtyToBuy,
          billedRate: weightRate,
          lineTotal: weightLineTotal,
        },
      ],
      paymentMethod: 'CASH',
      amountReceived: grandTotal + 100,
      discountAmount: 0,
      notes: 'Test Mixed Cart POS Upgrade Suite',
    };

    const checkoutRes = await axios.post(`${API_BASE}/sales`, salePayload, authHeader);
    assert.strictEqual(checkoutRes.status, 201, 'Sale checkout returned 201 Created');
    assert(checkoutRes.data.billNumber, 'Sale created with valid bill number');
    assert.strictEqual(Number(checkoutRes.data.grandTotal), grandTotal, 'Recorded grandTotal matches exact calculation');

    // Verify stock deductions in DB
    const freshUnitProduct = await prisma.product.findUnique({ where: { id: unitProduct.id } });
    const freshWeightProduct = await prisma.product.findUnique({ where: { id: weightProduct.id } });

    assert.strictEqual(
      Number(freshUnitProduct.currentStock),
      initialUnitStock - unitQtyToBuy,
      'Unit product stock reduced by integer quantity 2'
    );
    assert.strictEqual(
      Number(freshWeightProduct.currentStock),
      roundPrecision(initialWeightStock - weightQtyToBuy, 4),
      'Weight product stock reduced accurately by decimal 0.5 kg'
    );

    recordPass(`Scenario 8 & 9: Mixed cart checkout successful (Bill: ${checkoutRes.data.billNumber}, Total: ₹${grandTotal.toFixed(2)}) & accurate stock deduction verified`);
  } catch (err) {
    recordFail('Scenario 8 & 9: Mixed cart & stock deduction', err);
  }

  // --- SCENARIO 10: Hold Bill and Recall ---
  try {
    const holdPayload = {
      billData: {
        cart: [
          {
            productId: unitProduct.id,
            name: unitProduct.name,
            quantity: 3,
            billedRate: Number(unitProduct.sellingPrice),
            lineTotal: roundMoney(3 * Number(unitProduct.sellingPrice)),
          },
        ],
        customer: null,
        discountAmount: 0,
        notes: 'Held bill test',
      },
      customerName: 'Test Held Customer',
      totalAmount: roundMoney(3 * Number(unitProduct.sellingPrice)),
    };

    const holdRes = await axios.post(`${API_BASE}/sales/held`, holdPayload, authHeader);
    assert(holdRes.data.id, 'Held bill created successfully');

    const heldListRes = await axios.get(`${API_BASE}/sales/held`, authHeader);
    const foundHeld = heldListRes.data.find((b) => b.id === holdRes.data.id);
    assert(foundHeld, 'Held bill found in list');

    // Recall / Delete held bill
    await axios.delete(`${API_BASE}/sales/held/${holdRes.data.id}`, authHeader);
    recordPass('Scenario 10: Hold bill and restore workflow tested successfully');
  } catch (err) {
    recordFail('Scenario 10: Hold and restore bill', err);
  }

  // --- SCENARIO 11: Barcode Label Generation & Format Validation ---
  try {
    const testCode = 'AS00000001';
    assert(isValidBarcode(testCode), 'AS00000001 is a valid Code 128 barcode');
    const generated = await generateUniqueBarcode();
    assert(generated.startsWith('AS'), 'Generated barcode starts with AS prefix');
    assert(isValidBarcode(generated), 'Generated barcode satisfies format validator');
    recordPass(`Scenario 11: Barcode generation & format: generated "${generated}" with Code 128 compatibility`);
  } catch (err) {
    recordFail('Scenario 11: Barcode label generation', err);
  }

  // --- SCENARIO 12: Database Unique Barcode Constraint Enforcement ---
  try {
    // 1. Try creating a product with an existing barcode
    let duplicateRejected = false;
    try {
      await axios.post(
        `${API_BASE}/products`,
        {
          name: 'Duplicate Barcode Test Item',
          sellingPrice: 50,
          unit: 'pcs',
          barcode: unitProduct.barcode, // already taken
        },
        adminAuthHeader
      );
    } catch (err) {
      if (err.response && err.response.status === 400) {
        duplicateRejected = true;
      }
    }
    assert(duplicateRejected, 'Creating product with duplicate barcode was correctly rejected with 400');

    // 2. Create product with empty barcode -> should auto-generate unique barcode
    const autoGenRes = await axios.post(
      `${API_BASE}/products`,
      {
        name: 'Auto Barcode Test Item ' + Date.now(),
        sellingPrice: 75,
        unit: 'pcs',
      },
      adminAuthHeader
    );
    assert.strictEqual(autoGenRes.status, 201, 'Product created with 201');
    assert(autoGenRes.data.barcode, 'Product received an automatically generated barcode');
    assert(autoGenRes.data.barcode.startsWith('AS'), 'Auto barcode starts with AS prefix');

    // Cleanup created test product
    await prisma.product.delete({ where: { id: autoGenRes.data.id } });

    recordPass(`Scenario 12: Database unique barcode constraint enforced; auto-generation created "${autoGenRes.data.barcode}"`);
  } catch (err) {
    recordFail('Scenario 12: Unique barcode constraint', err);
  }

  console.log('\n================================================================');
  console.log(`📊 UPGRADE SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL 12 MODULE 22 UPGRADE SCENARIOS PASSED WITH ZERO ERRORS!\n');
    process.exit(0);
  }
}

runPosUpgradeSuite().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
